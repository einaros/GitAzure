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

# Deploy dependencies
copy-item -force "$source\..\deps\7z\7za.exe" "$dest\bin"
copy-item -force -recurse "$source\..\deps\scripts\*" "$dest\bin"
& "$dest\bin\update-csdef.ps1"

# Update package.json
if ((test-path $dest\package.json) -eq $false) {
	npm init
}
node "$source\packageupdate.js"

# Output howto
if ((test-path $dest\.git) -eq $false) {
	write-host "In order for the deployment to work, the current folder must be initialized as a git repository,"
	write-host "which is pushed to Github. Please run 'git init' and 'git remote add ...' or similar to initialize"
	write-host "the connection."
	write-host 
}
write-host "Attach the GitAzure bootstrapper script in your server.js such as:"
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
write-host "Finally if you're planning to use this with a private repo, add a fresh pair of id_rsa and"
write-host "id_rsa.pub to the bin\.ssh folder below this folder, and ensure that the public key is"
write-host "included in your Github account if the repository is a private one."