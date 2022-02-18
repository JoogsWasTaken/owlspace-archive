---
title: "Unveiling Steam's browser login method (for real this time)"
date: 2021-03-30T12:43:01+00:00
tags: [ "steam", "rsa", "crypto", "cybersec", "netsec", "ssl", "tls", "javascript", "password", "https", "security" ]
description: "A definitive look at what Steam needs all these public keys for."
draft: false
images: [ "/images/steam-rsa/hero2.png" ]
---

Not even 24 hours after I initially published my post on Steam's web login shenanigans, I was flooded with comments, suggestions, stories and mails. It absolutely blew me away and I took my time to read through every single response. Since then, I have gained new insights and, in my humble opinion, a pretty conclusive look at what it is that Steam is doing with the passwords of their users. This article aims to fill in the gaps of my original post. Any questions that popped up back then will hopefully be answered for good.

<!--more-->

I'm assuming that you, dear reader, have already read [my previous post on Steam's browser login mechanism]({{< ref "/cybersec/steam-login" >}}).
I won't be repeating information that I already provided back then.
Instead, I want to dig deeper and find out what exactly the purpose of Steam encrypting their users' passwords in the browser is.
All this is based on the countless suggestions I received since then (which I'm eternally thankful for!) and my own research that I have done since then.

### Theory 0x0: Parity feature between desktop and web client

Imagine it's 2002. You're working at Valve and you're ready to release this new cool product called Steam for beta testing. You'll be able to access it in the browser and through a desktop application. We're talking about a time when TLS 1.0 was released three years prior and widespread use of SSL certificates hasn't really caught on yet. Evidently, you need to secure your users' credentials in some way before they're being sent over the wire. Why not use a solution that works both in the browser and in the client?

This is a theory that's been brought up a couple times. RSA implementations are available for most, if not all, programming languages, frameworks and platforms. So using the same authentication method in the browser and the client would make a lot of sense. No need to maintain two different solutions to the same problem, right?

If you spent a bit of time in the community-driven side of Steam, you may have stumbled upon the name xPaw. They created and maintain both [SteamDB](https://steamdb.info/) and [Steam Status](https://steamstat.us/). Furthermore, they contribute to a lot of open-source Steam-related efforts. It's safe to say that xPaw knows a lot more about the internal workings of Steam than I do, and [they pointed me to SteamKit](https://twitter.com/thexpaw/status/1347486295187202049) --- a reverse-engineering effort into creating a library to interact with the Steam network.

{{< figure src="/images/steam-rsa/steamkit-rsa-pubkey.png" alt="Hardcoded RSA public key in the open source Steam library SteamKit" caption="No rotating RSA public keys, just static keys for every Steam universe (see [SteamKit](https://github.com/SteamRE/SteamKit/blob/master/SteamKit2/SteamKit2/Util/KeyDictionary.cs))" >}}

This is where it becomes evident that the Steam client doesn't leverage any of the browser login mechanisms. The Steam client bases all of its communication with the Steam services on encrypted protobuf messages. And although RSA is being used for encryption, the actual public keys are hardcoded into the client.

Note that hardcoded public keys are actually a more reasonable option for authentication as opposed to a rotating public key system.
Assume that Steam's browser-based login was meant to be used on plain HTTP connections.
Then an attacker could just intercept the public key request and insert their own, since Steam's public keys are not signed in any verifiable way.
Therefore, we can safely rule this theory out.

### Theory 0x1: Mitigation against passive sniffing attacks

Let's stay in the year 2002, still under the assumption that HTTPS is not commonplace. Another theory, and by far the most popular one from what I've seen, is that it's a way of thwarting passive sniffing attacks. If a malicious actor is able to view your requests and the subsequent responses as you're logging in via the Steam web interface, your password would still be safe. This seems like a reasonable mitigation on the surface. But similar to the previous theory, this one falls apart pretty quickly as well.

Although the actual password is obscured, it still acts as a token that can be used to authenticate. This means that while it'll be infeasible for an attacker to try and decrypt the password, they may as well just use the encrypted password to authenticate themselves on behalf of the victim.

Not only that, but Steam doesn't check if it has seen a certain encrypted password before. It is worth knowing that the RSA library that encrypts the user's password in the browser does so according to the [PKCS #1 v1.5 standard](https://tools.ietf.org/html/rfc2313). Encrypted data is padded with pseudorandom bytes, which means that every time the user's password is encrypted, the resulting blob should look different. All Steam would have to do on their end is to verify that the same blob doesn't appear twice in the same login session. However, one can just replay a login request. 

{{< video src="/images/steam-rsa/steam-login-replay.webm" caption="Simply replaying the login request is enough" >}}

In fact, one doesn't need to replay the entire request.
Login requests against Steam's servers are filled with lots of session identifiers and such, but in reality one only needs three fields in the request body to successfully authenticate.
Those fields are `password` which contains the encrypted password blob, `username` which is the account name of the user that's trying to login, and `rsatimestamp` which refers to the timestamp of the RSA public key used to encrypt the user's password.

```text
joogs@owlspace:~$ curl -v -X POST \
    -d "password=XXXXX_ENCRYPTED_PASSWORD_BLOB_GOES_HERE_XXXXX" \
    -d "username=XXXXX_ACCOUNT_USERNAME_GOES_HERE_XXXXX" \
    -d "rsatimestamp=XXXXX_RSA_PUBKEY_TIMESTAMP_GOES_HERE_XXXXX" \
    https://store.steampowered.com/login/dologin
Note: Unnecessary use of -X or --request, POST is already inferred.
...
< HTTP/1.1 200 OK
< Server: nginx
< Content-Type: application/json; charset=utf-8
...
< Set-Cookie: steamLoginSecure=XXXXX; Path=/; Secure; HttpOnly; SameSite=None
{
    "success":true,
    ...
    "transfer_parameters": {
        "steamid": "XXXXX",
        "token_secure": "XXXXX",
        "auth": "XXXXX",
        "remember_login": false
    }
}
```

If you're careless like me however, you might also want to provide the `captchagid` and `captcha_text` fields since simply fiddling with `curl` until something worked apparently raised suspicions in Steam's backend.
However, Steam kindly provides an ID of a captcha on a failed login request, even on the command line, which you can simply check by heading to `https://store.steampowered.com/login/rendercaptcha/?gid=XXX_CAPTCHA_GID_HERE_XXX` in any browser and adding the corresponding aforementioned fields to your login request.

I think it should be obvious by now that the way Steam handles logins does nothing to mitigate passive sniffing attacks, or even replay attacks for that matter.
Together with the previous theory, it's clear that, no matter which angle you're looking from, Steam's browser login scheme always falls short somewhere under the pretense that it's meant for use on insecure connections.
Perhaps we need to look elsewhere. 

### Theory 0x2: Hiding cleartext passwords on the backend

The final theory, and arguably the most compelling one, assumes that the main goal of client-side encryption in this case is to not add an extra layer of security for users, but to keep cleartext passwords from appearing in Steam's server logs.
One of the first network components you're likely to hit after sending a request to Steam's network are load balancers.
Though distributing network load among many servers is their main job, they are also able to terminate TLS connections, as in every data packet they forward into Steam's internal network are unencrypted from that point forth.
This is mainly to reduce the compute-intensive load of decrypting data packets.

{{< figure src="/images/steam-rsa/steam-backend.png" alt="Network diagram containing possible route from user to authentication service" caption="An extremely oversimplified network diagram; the red path marks all traffic after TLS has been terminated" >}}

However, this means that even the most sensitive incoming network traffic is received and processed in plain text after the load balancer.
Steam logs incoming and outgoing network requests just like any other service.
It's not unlikely they log entire request bodies at some crucial points in their infrastructure.
This means that users' passwords could appear in plain text in their server logs, had they not been encrypted prior to sending.

Their authentication service is one component among many in their internal infrastructure.
As such, it doesn't really matter if encrypted passwords appear in logs somewhere on their network, as long as the auth service is the only one capable of decrypting them to verify their correctness.
Of course I can't look into Steam's inner workings and verify this theory myself, but it's definitely the most reasonable out of all that have been brought to my attention.

### Old vulns never die

So now that we can most likely assume that Steam encrypts users' passwords in their browsers to avoid cleartext passwords being leaked in their logs, let's close this topic with some final observations.
One particularly astute user over on [r/netsec](https://www.reddit.com/r/netsec) pointed out an interesting observation about the JavaScript library that's used to perform RSA encryption in the browser.

> I've also seen such companies use Tom Wu's RSA JavaScript implementation which is shocking. For one, it uses PKCS#1 V1.5, which is vulnerable to the Bleichenbacher attack (yeah I know, hard to exploit in practice but come on, this has been obsolete since 1999).  But another problem is that when Wu attempted to upgrade the library, he broke away from the standard by treating byte paddings like unicode strings. This is just wrong, and leads to implementation problems.
>
> --- /u/ScottContini ([comment](https://www.reddit.com/r/netsec/comments/ksn6rc/steams_login_method_is_kinda_interesting_rsa/gij1d64/))

Referring to Wikipedia, the Bleichenbacher attack "took advantage of flaws within the PKCS #1 function to gradually reveal the content of an RSA encrypted message", see the "Practical Attacks" section in the article on [adaptive chosen-ciphertext attacks](https://en.wikipedia.org/wiki/Adaptive_chosen-ciphertext_attack).
As mentioned by the commenter, it's not exactly easy to pull off, but it's a serious flaw in the corresponding encryption scheme nonetheless which has since been superseded by the use of other padding functions like OAEP.

What's even more interesting is that only a couple days after I released my post on Steam's login scheme, I stumbled upon a vulnerability that had its CVE record created in September 2020.
[CVE-2020-25659](https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2020-25659) describes a vulnerability in the Python module `python-cryptography` which --- who would've guessed it --- implements PKCS #1 v1.5 in a way that makes it vulnerable to the Bleichenbacher attack.
Same issue, different project.

### Patterns that weren't

In my original post, the most speculative part concerned possible patterns in the way Steam issues RSA public keys.
To recap, every public key that Steam sends out comes with a `timestamp` that's given in microseconds as well as `token_gid` which is some identifier for all I knew back then.
I had a very limited dataset to work with, so I [ran my script for fetching Steam's public keys](https://gist.github.com/JoogsWasTaken/8a8e60859e1721255c57e9185eb6cb10) every 30 minutes on a Raspberry Pi I had lying around and just left it be for a while.
The goal was to leave it running for as long as I possibly could and amass heaps of public keys to analyze.
Over the span of 33 days, I ended up with 797 distinct public keys.
The results are ... a little underwhelming.

First off, since I took note of the time at which a public key request was issued, I could subtract the amount of microseconds in the `timestamp` field from it to find the starting point of the public key rotation.
I expected the `timestamp` value to reset in fixed intervals, but I couldn't have been further from the truth.
These "starting points" had no pattern in them, which becomes evident when plotting the value of the `timestamp` field of a public key over the time at which it was requested.

{{< figure src="/images/steam-rsa/steam-pubkey-rotation.png" alt="Chart plotting the value of the timestamp field over the time at which the corresponding public key was requested" caption="Excuse the Excel chart that I clumsily put together in three minutes" >}}

And while it's more clear than ever to me that new public keys are issued every hour per user, I haven't been able to verify the weird edge case in my original post where due to the slight offset of the value in the `timestamp` field, one might be able to receive a public key past its one-hour lifespan.
It was an incredibly bold claim of mine and it caused me more headaches than necessary.

To close things out, I received an excellent suggestion on the `token_gid` field via mail.
It's very likely that it's simply used to correlate public and private keys in the backend of Steam's auth service.
It doesn't possess any attributes that could possibly leak the corresponding private key, which means it's safe to send along.

Something I didn't notice at first was that the value of `token_gid` simply increases on subsequent public key requests.
Unfortunately, the `token_gid` value also seems to be correlated with the `timestamp` field to some degree.
When the `timestamp` value resets, the `token_gid` value jumps back and forth as well.
I was hoping to use the `token_gid` to find out how many login attempts are performed against Steam's servers every hour, but this doesn't seem doable.

{{< figure src="/images/steam-rsa/pubkey-jump.png" alt="Table of request timestamp, public key timestamps and public key IDs, with a large gap when the timestamp reset in both of the latter columns" caption="Note the marked gap in the timestamp and the token ID compared to the rest" >}}

If anything, this reinforces the assumption that public keys may be drawn from a big pool of sorts instead of being generated on-the-fly.
Steam may have some beefy servers, but whether it's feasible for them to create a new 2048-bit RSA keypair for every login attempt of every user on every hour is debatable.

### This is where the journey ends

Once again, I'd like to thank every single person that decided to comment on my original post, whether it'd be on any social network, or by mail with helpful insights.
I received a lot of great suggestions and I hope that this follow-up post did the sheer amount of feedback justice.
I spent a lot of time on this one subject and there's still a lot more to discover, and I hope that everyone who decided to hang around follows along.