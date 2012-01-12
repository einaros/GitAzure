# GitAzure #

Github hook for node.js apps hosted in Microsoft Azure.

The goal of this project is to provide a source-control guided deployment procedure for Azure apps. After initial deployment using the Azure tools, subsequent deployments should be cross-platform.

A rather terribly cropped first screencast, of GitAzure used to publish updates from OS X to Azure, can be found at http://screencast.com/t/Dj4ilALj.

## Creating a node.js application from scratch, hosted in Azure, source-controlled by Github. ##

This documentation is currently aimed at those with some prior Azure knowledge. That will change.

Step by step creating an application:

  1. Unless you already have git for Windows, install msysgit from http://code.google.com/p/msysgit/downloads/detail?name=Git-1.7.8-preview20111206.exe&can=2&q=
  2. Install node.js from http://nodejs.org
  3. `npm install -g GitAzure`
  4. `New-AzureService servicename`
  5. `Add-AzureNodeWebRole`
  6. `cd WebRole1`
  7. `Enable-AzureRemoteDesktop`
  8. `gitazure.cmd`; follow the instructions.
  9. As noted, put a valid Github id_rsa and id_rsa.pub keypair in WebRole1\bin\.ssh, e.g. by copying pre-existing from $env:USERPROFILE\\.ssh
  10. In git bash within the WebRole1 folder, do `git add .`, `git commit -am 'initial'` then `git push -u origin master`
  11. `Publish-AzureService`; this will take roughly 10 minutes.
  12. Add http://yoursite.cloudapp.net/githook to the service hooks of your github repository.

At this point you should be able to make changes to the code in the repository, and publish updates to your Azure application by pushing to Github. That includes writing code on other platforms than Windows.

GitAzure also supports installing npm modules, and will execute `npm install` on the server whenever changes to package.json are detected.

Some settings are available within your web role's gitazure.json config file, which among other things allows you to restrict application updates to a specific branch (e.g. 'azure').

More to come.

## Todo ##

* Deal with forced pushed, e.g. by replacing the `git pull` call with a `git fetch origin && git reset origin/branch` combo.
* Expand the lib/gitazure.js test case. Verify, using sample service hook postdata, that the correct commands are being run.
* Consider preserving the initially published web.config, e.g. by copying Web.cloud.config to Web.config in case of a change to either.