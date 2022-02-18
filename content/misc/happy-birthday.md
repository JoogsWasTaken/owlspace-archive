---
title: "HapPY Birthday: A custom CTF challenge for a non-CTF player"
date: 2020-11-13T17:48:01+01:00
lastmod: 2020-11-13T17:48:01+01:00
publishDate: 2020-11-13T17:48:01+01:00
tags: [ "Python", "CTF", "Reversing", "Bytecode", "Crypto", "Base64", "Fernet", "Challenge", "Code" ]
description: "Illustrating my path towards creating a CTF challenge for my roommates' birthday who has never played CTFs before."
draft: false
images: [ "/images/birthday-ctf/hero.png" ]
---

I like CTFs. Admittedly, I'm not particularly good at them. I try my best and learn from other people's solutions to unique challenges after the end of a competition. I also like my roommate who I've known for several years now. And even though he's a magnificent problem solver, at least in my opinion, I'm yet to convince him to team up and play some CTFs together. It was his birthday very recently and I prefer experiences as gifts as opposed to materialistic things. So I cobbled together a relatively simple CTF-style challenge for him. In this article, I want to outline a couple interesting bits here and there that I learned in the process of creating a custom challenge. Maybe you'll find yourself inspired to create a simple challenge of your own.

<!--more-->

### Simple in concept

I knew he's quite proficient in all things concerning Python. I also knew that he's never participated in any CTF before and that the objective should be rather obvious without making the path towards the solution too easy. So before I spoil the challenge, I'd like to give you, the reader, a chance at solving it yourself. Originally, I put up the challenge file as well as a short description on my webspace provided by my uni and sent him the link on his birthday.

{{< figure src="/images/birthday-ctf/ctf-page.png" alt="Website hosting the challenge file" caption="The original challenge description as published on [PERSONAL INFORMATION REDACTED]" >}}

The title should be self-explanatory. The description reads as follows. "Instead of congratulating you every year, I wrote a program which generates new well wishes every time. But now I secured it so well that I can't access the source code anymore. You know Python, right?" You can download the [challenge file](/happy-birthday-ctf/main.py) and the [checksum](/happy-birthday-ctf/sha256sum.txt) right now and try and solve it yourself.

Parts of the challenge have been altered to exclude any potential personal information, so don't be too sad if the final solution doesn't turn out to be tailored to you and just you. The methodology to get to the solution is still the same. This is your final chance to have an unspoiled go at the challenge before you keep reading. I promise it's easy, but I will be detailing the steps towards the solution as well as my little journey to coming up with challenge in the following sections.

### Simple in practice

The challenge file contains Python bytecode. You'll find a wide range of tools to help you revert bytecode back into its source code representation. I found that [uncompyle6](https://pypi.org/project/uncompyle6/) worked the best for me after changing the file extension from `.py` to `.pyc`. The decompiled source code can then be redirected into a new file.

```python {linenos=table}
import base64, sys, re
from cryptography.fernet import Fernet
_key = b'VmpGa2QxVXlWbkpOVm1oVllsWndZVmx0TVROa01WSlZVMnMxYTAxVmNFbFdiVEZoVjIxR2NsZHFWbUZTVjFKMldWUkJNVkl5U2toWGJIQm9ZVEJ3YUZaVldsSmxSMHBXVFZWb1VGWXllRk5XTUZaeVQxRTlQUT09'
_data = b'gAAAAABfrpsbWVFixtOzHNPpVhWTp7rbpKu7VFjFTyPyWwo14eCUmWPFaZ5A1hvb_F-5yWzY-5zT6-n2CspytLuy3oa28xPd8BmUWknu5iykPw_zjgj_5J_W1Mpka9ph98mMQMsmqdUQ5s3QqHtoPZEnxbQLBhfpg9iwLzfP5e7D9JhmbEaITX7hH3D-EKtT5Y07fDWYt6bgAV61eNaibeJnE2yhvIDFUC1XfIQVBFXBE0IjYs1UYrMtP64LVEZsJds8XstIvb7OA10ARjLNXY3vk0niTk1rpw=='

def main():
    i = sys.argv[1] if len(sys.argv) >= 2 else 'foobar'
    b = i.encode('ascii')
    for _ in range(0, 5):
        b = base64.b64encode(b)
    else:
        if not b == _key:
            exit()
        f = Fernet(base64.b64encode(re.sub('[34]', '', i).encode('ascii')))
        print(f.decrypt(_data).decode('utf-8'))


if __name__ == '__main__':
    main()
```

Uncompyle produces the source code above. Your mileage may vary, but the overall structure should be the same. Two things should jump out rightaway. First, the code depends on the `cryptography` module which is not part of the standard Python library and needs to be installed via the Python package manager. Second, the literal key to this challenge must be supplied as a command line argument. So let's take a look at what the script does.

It assigns the first command line parameter to a variable `i`. It is then base64-encoded five times in a row before being compared to the value of the `_key` variable. If they don't match, the program exits. Otherwise, it decrypts whatever is stored inside the `_data` variable, using the command line parameter as the decryption key, and prints it out to the console.

The solution is fairly straightforward. Take the value of the `_key` variable and base64-decode it five times in a row to get the human-readable key. Then use it on the command line to call the script and you'll get your verification that you solved the challenge correctly.

```text
joogs@owlspace:~/happy-birthday-ctf$ python main.py b4s1c_byt3c0De_b1rthd4Y_b0Y==f0obAr 
Congrats! You solved this challenge. Now keep reading to find out just what can possibly go wrong in designing a challenge this simple on the surface.
```

My roommate ended up solving the challenge after just a tiny hint not to sink too deeply into the cryptography rabbit hole. And of course, the message he uncovered was a lot more heartfelt and sincere than what you're seeing in the listing above. It'd be a shame if I withheld his initial reaction to solving the challenge.

{{< figure src="/images/birthday-ctf/response.png" alt="Roommate's reaction to having solved the challenge" caption="I count that as a resounding success" >}}

Despite the simplicity of the challenge itself, there are still a couple things you have to know. You need to be aware that Python can be compiled into bytecode which, in turn, can be easily converted back into source code. You need to be able to find tools to help you automate this step. You need to be able to read code and analyze points of entry which, in this particular example, is simply the command line. And you need to know a little bit about text encodings. I'm pretty confident that all of these things can be accomplished within a reasonable time frame with little knowledge about these subjects at all. In the end, what really matters in a CTF environment is the ability to research stuff yourself and implement your own solutions.

### Not so simple in everything else

As I've outlined earlier, I needed to keep the challenge as simple as possible without making it too easy. I knew he'd figure out the Python bytecode part pretty quickly, so I had to concentrate my efforts into obfuscating the source code as well as I could. I was hoping that Uncompyle would do its part in making the reconstructed source code a little less legible, but I was actually fairly impressed at how close it came to the original source. The only exception is the `for`-`else` structure starting at line 9 in the source code showcased above which I had never seen in any Python script before. This just goes to show that there's always stuff to be learned, even when it's not intended.

I spent a bit of my time figuring out how to obfuscate the decryption key. Using a base64-encoded key in the source code, running the same encoding strategy on the input to the script and comparing them for equality seemed straightforward enough to me. However, I couldn't use the encoded key as the decryption key to the message because that'd completely thwart the search for the solution. In this situation, one could just execute something like `print(Fernet(_key).decrypt(_data))` which is not what I intended. After all, I was putting effort into creating an easily recognizable key once decoded and I didn't want that "easter egg", for lack of a better term, to go unnoticed.

And that brings me to the biggest timesink of them all: the `cryptography` module. Of course I should've known better that some Python crypto module I found somewhere online wouldn't just accept any key I threw at it. It requires a [URL-safe base64-encoded 32-byte key](https://cryptography.io/en/latest/fernet.html#cryptography.fernet.Fernet) as pointed out in the documentation. Now I have a very rigid sleep schedule and it was nearing midnight and I was so proud of the key I came up with. I was already picturing how my roommate would be hollering at the leetspeakified inside joke only to find out that it didn't meet the specified requirements.

My last few active brain cells couldn't make sense of whether the 32-byte requirement was to be met before or after base64-encoding. And even then, how was I supposed to derive a suitable key from the input to the script? You may have wondered about the inclusion of the `re` module on line 15 in the source code above, but that's exactly what it accomplishes. I realized I could just remove a couple characters from the input until it met the length requirement perfectly. Even better: it added another thin layer of obfuscation. This meant that nothing of the "key derivation" part alluded to the key itself which was exactly what I wanted.

### CTFs are fun

Before you ask: no. Even after creating a custom challenge for him, I couldn't convince my roommate to join me for some CTFs. Not yet anyway. What's more important is that I had fun crafting the challenge and he had fun solving it. I have nothing but respect for CTF authors who contribute unique challenges to the community as a whole. And if you're searching for a cool gift for one of your nerdy friends: try crafting a challenge of your own. If you're unsure on how to go about it, I recommend LiveOverflow's video on ["Guessing vs. Not Knowing in Hacking and CTFs"](https://www.youtube.com/watch?v=L1RvK1443Yw) to get an idea of how not to design a challenge. Other than that, let your creativity flow. Create something cool.