"""Bounded extraction into a fresh owned output, never a source checkout."""
import sys,pathlib,zipfile,tarfile,shutil,stat,re
archive,destination,prefix=map(str,sys.argv[1:]);dest=pathlib.Path(destination);assert not dest.exists();dest.parent.mkdir(parents=True,exist_ok=True);raw=dest.with_name(dest.name+'.extract');assert not raw.exists();seen=set();total=0

def check(name,size):
 global total
 p=pathlib.PurePosixPath(name.replace('\\','/'));assert not p.is_absolute() and '..' not in p.parts and not any(':' in x or any(ord(c)<32 for c in x) for x in p.parts)
 assert all(not x.endswith(('.', ' ')) and not re.match(r'(?i)^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:[.]|$)',x) for x in p.parts)
 key=str(p).rstrip('/').casefold();assert key not in seen;seen.add(key);assert len(seen)<50000;total+=size;assert 0<=size<=1024**3 and total<=4*1024**3
 if prefix:assert str(p)==prefix or str(p).startswith(prefix+'/')
raw.mkdir()
if zipfile.is_zipfile(archive):
 with zipfile.ZipFile(archive) as z:
  for entry in z.infolist():check(entry.filename,entry.file_size);assert not stat.S_ISLNK(entry.external_attr>>16)
  z.extractall(raw)
else:
 with tarfile.open(archive) as t:
  for entry in t.getmembers():check(entry.name,entry.size);assert entry.isdir() or entry.isfile() or entry.issym() or entry.islnk()
  t.extractall(raw,filter='data')
if prefix:(raw/prefix).replace(dest);raw.rmdir()
else:raw.replace(dest)
