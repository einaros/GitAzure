if ((test-path ..\ServiceDefinition.csdef) -ne $true) {
	Write-Host ServiceDefinition.csdef not found in parent directory. 
	Write-Host Make sure you execute this script in the Web Role directory.
	exit -1
}

[xml]$xml = Get-Content ..\ServiceDefinition.csdef

function getXmlNode($str) {
	$docfrag = $xml.CreateDocumentFragment()
	$docfrag.InnerXml = "<x xmlns=""http://schemas.microsoft.com/ServiceHosting/2008/10/ServiceDefinition"">" + $str + "</x>"
	$docfrag.FirstChild.FirstChild
}

$ns = New-Object Xml.XmlNamespaceManager $xml.NameTable
$ns.AddNamespace("e", "http://schemas.microsoft.com/ServiceHosting/2008/10/ServiceDefinition" )

if ($xml.SelectNodes("//e:Task[@commandLine='setup_git.cmd']", $ns).Count -le 0) {
	$node = $xml.SelectSingleNode("//e:Startup", $ns)
	$node.AppendChild((getXmlNode("<Task commandLine=""setup_git.cmd"" executionContext=""elevated""><Environment><Variable name=""EMULATED""><RoleInstanceValue xpath=""/RoleEnvironment/Deployment/@emulated"" /></Variable><Variable name=""GITPATH""><RoleInstanceValue xpath=""/RoleEnvironment/CurrentInstance/LocalResources/LocalResource[@name='Git']/@path"" /></Variable></Environment></Task>")))
}

if ($xml.SelectNodes("//e:Task[@commandLine='install_nodemodules.cmd']", $ns).Count -le 0) {
	$node = $xml.SelectSingleNode("//e:Startup", $ns)
	$node.AppendChild((getXmlNode("<Task commandLine=""install_nodemodules.cmd"" executionContext=""elevated""><Environment><Variable name=""EMULATED""><RoleInstanceValue xpath=""/RoleEnvironment/Deployment/@emulated"" /></Variable></Environment></Task>")))
}

if ($xml.SelectNodes("//e:LocalStorage[@name='Git']", $ns).Count -le 0) {
	$node = $xml.SelectSingleNode("//e:LocalResources", $ns)
	if ($node -eq $null) {
		$node = $xml.SelectSingleNode("//e:Startup", $ns)
		$node = $node.ParentNode.InsertAfter((getXmlNode("<LocalResources />")), $node)
	}
	$node.AppendChild((getXmlNode("<LocalStorage name=""Git"" sizeInMB=""1000"" />")))
}
$xml.Save((Get-Location).Path + "\..\ServiceDefinition.csdef")
