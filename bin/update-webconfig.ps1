[xml]$xml = Get-Content "Web.cloud.config"
function getXmlNode($str) {
	$docfrag = $xml.CreateDocumentFragment()
	$docfrag.InnerXml = $str
	return $docfrag
}
if ($xml.SelectNodes("//system.webServer/handlers/add[@name='iisnodeGitAzure']").Count -le 0) {
	$node = $xml.SelectSingleNode("//system.webServer/handlers")
	$node.AppendChild((getXmlNode("<add name=""iisnodeGitAzure"" path=""node_modules\GitAzure\server.js"" verb=""*"" modules=""iisnode"" />")))
}
if ($xml.SelectNodes("//rewrite/rules/rule[@name='GitAzure']").Count -le 0) {
	$node = $xml.SelectSingleNode("//rewrite/rules")
	$clearNode = $xml.SelectSingleNode("//rewrite/rules/clear")
	$node.InsertAfter((getXmlNode("<rule name=""GitAzure"" enabled=""true"" patternSyntax=""ECMAScript"" stopProcessing=""true""><match url=""githook"" /><conditions logicalGrouping=""MatchAll"" trackAllCaptures=""false"" /><action type=""Rewrite"" url=""node_modules/GitAzure/server.js"" /></rule>
")), $clearNode)
}
$xml.Save((Get-Location).Path + "\Web.cloud.config")
