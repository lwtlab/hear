"""Inspect a deb without extracting or executing any of its contents."""
import hashlib
import json
from pathlib import Path, PurePosixPath
import sys
import tarfile


class MemberReader:
    def __init__(self, source, size):
        self.source, self.remaining = source, size

    def read(self, size=-1):
        size = self.remaining if size < 0 else min(size, self.remaining)
        data = self.source.read(size)
        if len(data) != size:
            raise ValueError("Truncated ar member")
        self.remaining -= size
        return data


def normalized(name):
    while name.startswith("./"):
        name = name[2:]
    if name in ("", "."):
        return ""
    path = PurePosixPath(name)
    if path.is_absolute() or ".." in path.parts or "\\" in name or "\0" in name:
        raise ValueError("Unsafe deb member name")
    return str(path)


def inspect_deb(file, expected):
    if not expected or any(not isinstance(k, str) or not isinstance(v, str) or len(v) != 64 for k, v in expected.items()):
        raise ValueError("Expected payload hashes required")
    seen_ar, payload, control, hooks, data_types = set(), {}, None, {}, {}
    with Path(file).open("rb") as source:
        archive_size = source.seek(0, 2)
        source.seek(0)
        if source.read(8) != b"!<arch>\n":
            raise ValueError("Invalid ar archive")
        while True:
            header = source.read(60)
            if not header:
                break
            if len(header) != 60 or header[58:] != b"`\n":
                raise ValueError("Invalid ar member")
            name = header[:16].decode("ascii").strip().rstrip("/")
            if name in seen_ar:
                raise ValueError("Duplicate ar member")
            seen_ar.add(name)
            size = int(header[48:58].decode("ascii").strip())
            if size < 0 or size > 2 * 1024**3:
                raise ValueError("Invalid ar member size")
            start = source.tell()
            if start + size + size % 2 > archive_size:
                raise ValueError("Truncated ar payload")
            if name == "debian-binary":
                if source.read(size) != b"2.0\n":
                    raise ValueError("Unsupported deb version")
            elif name.startswith("control.tar") or name.startswith("data.tar"):
                if name not in {"control.tar", "control.tar.gz", "control.tar.xz", "control.tar.bz2", "data.tar", "data.tar.gz", "data.tar.xz", "data.tar.bz2"}:
                    raise ValueError("Unsupported deb compression")
                names = set()
                with tarfile.open(fileobj=MemberReader(source, size), mode="r|*") as archive:
                    for member in archive:
                        path = normalized(member.name)
                        if not path and member.isdir():
                            continue
                        if path in names:
                            raise ValueError("Duplicate deb payload path")
                        names.add(path)
                        if name.startswith("data.tar"):
                            if not (member.isfile() or member.isdir() or member.issym() or member.islnk()):
                                raise ValueError("Unsupported data member type")
                            data_types[path] = "directory" if member.isdir() else "non-directory"
                        if name.startswith("control.tar") and path == "control":
                            if control is not None or not member.isfile() or member.size > 1024**2:
                                raise ValueError("Invalid control file")
                            control = archive.extractfile(member).read().decode("utf8")
                        elif name.startswith("data.tar") and (path in expected or path.startswith("opt/AIHear/resources/app.asar.unpacked/node_modules/uiohook-napi/prebuilds/")):
                            if path not in expected and member.isdir():
                                root = "opt/AIHear/resources/app.asar.unpacked/node_modules/uiohook-napi/prebuilds/linux-x64"
                                if path != root and not path.startswith(root + "/"):
                                    raise ValueError("Foreign hotkey prebuild directory was packaged")
                                continue
                            if not member.isfile() or member.issym() or member.islnk():
                                raise ValueError("Required packaged bytes must be regular files: " + path)
                            content = archive.extractfile(member)
                            digest = hashlib.sha256()
                            total = 0
                            while chunk := content.read(1024**2):
                                digest.update(chunk)
                                total += len(chunk)
                            if total != member.size:
                                raise ValueError("Truncated payload")
                            value = {"bytes": total, "sha256": digest.hexdigest(), "mode": member.mode}
                            if path in expected:
                                if value["sha256"] != expected[path]:
                                    raise ValueError("Packaged input differs from built input")
                                payload[path] = value
                            else:
                                if not path.startswith("opt/AIHear/resources/app.asar.unpacked/node_modules/uiohook-napi/prebuilds/linux-x64/"):
                                    raise ValueError("Foreign hotkey prebuild was packaged")
                                if path.endswith(".node"):
                                    hooks[path] = value
            else:
                raise ValueError("Unexpected ar member")
            source.seek(start + size)
            if size % 2 and source.read(1) != b"\n":
                raise ValueError("Invalid ar padding")
    if control is None or "debian-binary" not in seen_ar or len([x for x in seen_ar if x.startswith("data.tar")]) != 1 or len([x for x in seen_ar if x.startswith("control.tar")]) != 1:
        raise ValueError("Missing deb sections")
    # Check after reading the complete tree: a later parent must not replace an
    # implicit directory with a link/file. Standard leaf links remain admissible.
    for path in data_types:
        for parent in PurePosixPath(path).parents:
            if str(parent) != "." and data_types.get(str(parent), "directory") != "directory":
                raise ValueError("Deb member traverses a non-directory ancestor")
    if set(payload) != set(expected) or not hooks:
        raise ValueError("Required packaged runtime absent")
    fields = {}
    for line in control.splitlines():
        if line.startswith((" ", "\t")) or not line:
            continue
        key, value = line.split(":", 1)
        if key in fields:
            raise ValueError("Duplicate control field")
        fields[key] = value.strip()
    return {"package": fields.get("Package"), "version": fields.get("Version"), "architecture": fields.get("Architecture"), "payload": payload, "hotkeyPrebuilds": hooks}


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise ValueError("One deb path required")
    print(json.dumps(inspect_deb(sys.argv[1], json.load(sys.stdin)), sort_keys=True))
