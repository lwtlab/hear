"""Read only the exact receipt/deb files; never honor archive paths or links."""
import hashlib
import json
from pathlib import Path
import stat
import sys
import zipfile


def unpack(file, output, expected):
    if not expected or len(expected) > 2:
        raise ValueError("Exact receipt/package set required")
    for name, size in expected.items():
        if "/" in name or "\\" in name or name in ("", ".", "..") or not isinstance(size, int) or not 0 < size < 1024**3:
            raise ValueError("Invalid expected file")
    output = Path(output)
    output.mkdir(mode=0o700)
    with zipfile.ZipFile(file) as archive:
        members = archive.infolist()
        if len(members) != len(expected) or {m.filename for m in members} != set(expected):
            raise ValueError("Unexpected archive contents")
        for member in members:
            mode = member.external_attr >> 16
            if member.flag_bits & 1 or member.is_dir() or (stat.S_IFMT(mode) not in (0, stat.S_IFREG)):
                raise ValueError("Only unencrypted regular files allowed")
            if member.file_size != expected[member.filename]:
                raise ValueError("Archive file size differs")
            with archive.open(member) as source, (output / member.filename).open("xb") as target:
                digest, count = hashlib.sha256(), 0
                while chunk := source.read(1024**2):
                    count += len(chunk)
                    if count > expected[member.filename]:
                        raise ValueError("Archive file exceeded declared size")
                    target.write(chunk)
                    digest.update(chunk)
                if count != member.file_size:
                    raise ValueError("Truncated archive file")


if __name__ == "__main__":
    unpack(sys.argv[1], sys.argv[2], json.load(sys.stdin))
