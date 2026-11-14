"""Bounded extraction into a fresh owned output, never a source checkout."""
import sys,pathlib,zipfile,tarfile,stat,re

class ArchivePolicy:
 def __init__(self,prefix,profile='runtime'):
  assert profile in ('runtime','sdk'),'Unknown archive profile'
  self.prefix=prefix;self.member_limit=(2 if profile=='sdk' else 1)*1024**3
  self.seen=set();self.total=0

 def check(self,name,size):
  p=pathlib.PurePosixPath(name.replace('\\','/'));assert not p.is_absolute() and '..' not in p.parts and not any(':' in x or any(ord(c)<32 for c in x) for x in p.parts)
  assert all(not x.endswith(('.', ' ')) and not re.match(r'(?i)^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:[.]|$)',x) for x in p.parts)
  key=str(p).rstrip('/').casefold();assert key not in self.seen;self.seen.add(key);assert len(self.seen)<50000
  assert 0<=size<=self.member_limit,'Archive member exceeds profile limit'
  self.total+=size;assert self.total<=4*1024**3,'Archive exceeds total limit'
  if self.prefix:assert str(p)==self.prefix or str(p).startswith(self.prefix+'/')

def extract(archive,destination,prefix,profile='runtime'):
 policy=ArchivePolicy(prefix,profile);dest=pathlib.Path(destination);assert not dest.exists();dest.parent.mkdir(parents=True,exist_ok=True);raw=dest.with_name(dest.name+'.extract');assert not raw.exists()
 raw.mkdir()
 if zipfile.is_zipfile(archive):
  with zipfile.ZipFile(archive) as z:
   for entry in z.infolist():policy.check(entry.filename,entry.file_size);assert not stat.S_ISLNK(entry.external_attr>>16)
   z.extractall(raw)
 else:
  with tarfile.open(archive) as t:
   for entry in t.getmembers():policy.check(entry.name,entry.size);assert entry.isdir() or entry.isfile() or entry.issym() or entry.islnk()
   t.extractall(raw,filter='data')
 if prefix:(raw/prefix).replace(dest);raw.rmdir()
 else:raw.replace(dest)

if __name__=='__main__':extract(*sys.argv[1:])
