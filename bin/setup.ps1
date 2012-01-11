param($source)
$dest = (Get-Location -PSProvider FileSystem).ProviderPath
[Environment]::CurrentDirectory = $dest

if ((($env:path).split(';') |? { test-path "$_\git.exe" })) {
	$git = "git"
}
else {
	$git = "${env:ProgramFiles(x86)}\git\bin\git.exe"
	if ((test-path $git) -eq $false) {
		$git = "$env:ProgramFiles\git\bin\git.exe"
		if ((test-path $git) -eq $false) {
			write-host "Cannot find git, please ensure that msysgit or equivalent is installed in path."
			exit -1
		}
	}
}

if ((test-path $dest\bin) -eq $false) {
	write-host Cannot find bin subfolder, please launch the script in a Azure node.js web role folder.
	exit -1
}

if ((test-path $dest\..\ServiceDefinition.csdef) -eq $false) {
	write-host Cannot find ServiceDefinition.csdef, please launch the script in a Azure node.js web role folder.
	exit -1
}

# Deploy dependencies

copy-item -force "$source\..\deps\7z\7za.exe" "$dest\bin"
copy-item -force -recurse "$source\..\deps\scripts\*" "$dest\bin"
$null = & "$source\update-csdef.ps1"

# Update package.json

if ((test-path $dest\package.json) -eq $false) {
	npm init
}
node "$source\packageupdate.js"

# Update web.config

$null = & "$source\update-webconfig.ps1"

# Deal with git

if ((test-path $dest\.git) -eq $true) {
	write-host "A git repository may already have been initialized in this folder."
	write-host "Please ensure that a remote has been added (e.g. git remote add origin https://github.com/user/repo.git)."
	write-host "If the origin repo is a private one, or has been added with git@github.com:username/repo.git, you will"
	write-host "need to put a valid pair of id_rsa and id_rsa.pub in .\bin\.ssh"
	write-host
	write-host "Also, seriously consider adding 'bin/' and 'node_modules' to your .gitignore file."
}
else {
	& $git init

	write-host "Please enter your github repository url below"
	write-host "Either on the form"
	write-host "  A: git@github.com:username/repo.git, or "
	write-host "  B: https://github.com/username/repo.git"
	write-host "Note that (A) will require an id_rsa and id_rsa.pub pair in .\bin\.ssh"
	$repoUrl = ""
	while ($repoUrl -eq "") {
		$repoUrl = read-host "Url"
		if ($repoUrl -ne "") {
			write-host $repoUrl
			$ok = read-host "Is this ok? ([y]/n)"
			if ($ok -ne "y" -and $ok -ne "") {
				$repoUrl = ""
			}
		}
	}
	& $git remote add origin $repoUrl
	[io.file]::AppendAllText(".gitignore", "`nbin/`nnode_modules/`n", [text.encoding]::ascii)
	
	write-host
	write-host "If the origin repo is a private one, or has been added with git@github.com:username/repo.git, you will"
	write-host "need to put a valid pair of id_rsa and id_rsa.pub to .\bin\.ssh"
	write-host
}

# Output default config

node "$source\configinit.js"
write-host "Check the gitazure.json configuration file in the current directory for configurable options."
write-host

# Final instructions

write-host "Finally, add http://yourapp.cloudapp.net/githook to your Github repository's service hooks."
write-host
