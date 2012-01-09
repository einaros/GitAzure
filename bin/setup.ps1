param($source)
$dest = get-location

if ((test-path $dest\bin) -eq $false) {
	write-host Cannot find bin subfolder, please launch the script in a Azure node.js web role folder.
	exit -1
}

if ((test-path $dest\..\ServiceDefinition.csdef) -eq $false) {
	write-host Cannot find ServiceDefinition.csdef, please launch the script in a Azure node.js web role folder.
	exit -1
}

copy-item -force "$source\..\deps\7z\7za.exe" "$dest\bin"
copy-item -force -recurse "$source\..\deps\scripts\*" "$dest\bin"
& "$dest\bin\update-csdef.ps1"

write-host "Please manually update your package.json to include:"
write-host "   ""dependencies"": { ""GitAzure"": ""latest"" }"
write-host
write-host "Then attach the GitAzure bootstrapper script such as:"
write-host 
write-host "   require('gitazure').listen(server, 'https://github.com/username/Repo', 'branch');"
write-host
write-host "Where:"
write-host "   'server' is an instance of node's http server, express.js or similar"
write-host "   'https://github.com/username/Repo' is the repository to use"
write-host "   'branch' is the branch from which to expect updates"
write-host 
write-host "Next, add http://yourapp.cloudapp.net/githook to your Github repository's service hooks."
write-host
write-host "Finally add a fresh pair of id_rsa and id_rsa.pub to the bin\.ssh folder below this folder, and"
write-host "ensure that the public key is included in your Github account if the repository is a private one."