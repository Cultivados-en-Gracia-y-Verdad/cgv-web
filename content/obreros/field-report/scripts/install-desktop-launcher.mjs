import {execFileSync} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

if(process.platform!=='darwin')throw new Error('Este instalador es únicamente para macOS.');

const appRoot=fileURLToPath(new URL('../',import.meta.url)).replace(/[\\/]$/,'');
const applicationsDir=path.join(os.homedir(),'Applications');
const bundlePath=path.join(applicationsDir,'Mensajeros CGV.app');
const contentsPath=path.join(bundlePath,'Contents');
const macOSPath=path.join(contentsPath,'MacOS');
const resourcesPath=path.join(contentsPath,'Resources');
const executablePath=path.join(macOSPath,'Mensajeros CGV');
const iconPath=path.join(resourcesPath,'MensajerosCGV.icns');
const iconSource=path.join(appRoot,'public','apple-touch-icon.png');
const temporaryRoot=await fs.mkdtemp(path.join(os.tmpdir(),'cgv-launcher-'));
const iconsetPath=path.join(temporaryRoot,'MensajerosCGV.iconset');

const xml=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const shellQuote=value=>`'${value.replaceAll("'",`'\\''`)}'`;

try{
 await fs.mkdir(macOSPath,{recursive:true});
 await fs.mkdir(resourcesPath,{recursive:true});
 await fs.mkdir(iconsetPath,{recursive:true});

 for(const [name,size] of [['icon_16x16.png',16],['icon_16x16@2x.png',32],['icon_32x32.png',32],['icon_32x32@2x.png',64],['icon_128x128.png',128],['icon_128x128@2x.png',256],['icon_256x256.png',256],['icon_256x256@2x.png',512],['icon_512x512.png',512],['icon_512x512@2x.png',1024]]){
  execFileSync('/usr/bin/sips',['-z',String(size),String(size),iconSource,'--out',path.join(iconsetPath,name)],{stdio:'ignore'});
 }
 execFileSync('/usr/bin/iconutil',['-c','icns',iconsetPath,'-o',iconPath]);

 const launcher=`#!/bin/zsh\nexport PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"\ncd ${shellQuote(appRoot)} || exit 1\nexec npm run desktop >> "$HOME/Library/Logs/Mensajeros-CGV.log" 2>&1\n`;
 await fs.writeFile(executablePath,launcher,{mode:0o755});
 await fs.chmod(executablePath,0o755);

 const plist=`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleDisplayName</key><string>Mensajeros CGV</string>
<key>CFBundleExecutable</key><string>Mensajeros CGV</string>
<key>CFBundleIconFile</key><string>MensajerosCGV</string>
<key>CFBundleIdentifier</key><string>org.discipuladocgv.mensajeros.admin</string>
<key>CFBundleName</key><string>Mensajeros CGV</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>1.0</string>
<key>CFBundleVersion</key><string>1</string>
<key>LSMinimumSystemVersion</key><string>12.0</string>
<key>NSHighResolutionCapable</key><true/>
<key>CGVProjectPath</key><string>${xml(appRoot)}</string>
</dict></plist>\n`;
 await fs.writeFile(path.join(contentsPath,'Info.plist'),plist);
 execFileSync('/usr/bin/touch',[bundlePath]);
 console.log(`Aplicación instalada: ${bundlePath}`);
 console.log('Ábrela con doble clic o arrástrala al Dock.');
}finally{
 await fs.rm(temporaryRoot,{recursive:true,force:true});
}
