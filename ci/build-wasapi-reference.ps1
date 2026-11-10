$ErrorActionPreference = 'Stop'
$reference = Join-Path $env:GITHUB_WORKSPACE 'reference/Samples/ApplicationLoopback/cpp'
Push-Location $reference
try {
  nuget restore packages.config -PackagesDirectory packages -NonInteractive
  if ($LASTEXITCODE -ne 0) { throw 'Reference dependencies failed' }
  $vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio/Installer/vswhere.exe'
  $msbuild = & $vswhere -latest -products '*' -requires Microsoft.Component.MSBuild -find 'MSBuild/**/Bin/MSBuild.exe' | Select-Object -First 1
  if (-not $msbuild) { throw 'MSBuild unavailable' }
  & $msbuild ApplicationLoopback.vcxproj /p:Configuration=Release /p:Platform=x64 /p:PlatformToolset=v143 /p:WindowsTargetPlatformVersion=10.0 /m
  if ($LASTEXITCODE -ne 0) { throw 'Reference build failed' }
} finally { Pop-Location }
