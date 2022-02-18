---
title: "School web app development: five years later"
date: 2021-01-02T13:41:32+01:00
tags: [ "webdev", "html", "php", "css", "coding", "android", "cybersec", "cybersecurity", "review", "code", "analysis" ]
description: "Taking a deep look at a web app I wrote for my school five years ago, and picking it apart to learn something about getting stuff done."
draft: false
images: [ "/images/vpmobil/hero.png" ]
---

As soon as I got my first Android-powered smartphone around nine years ago, I immediately researched how to create apps for it. And within no more than three days, I created an app that made my school's substitution plans accessible on mobile devices. A couple years passed, the app improved, and soon school staff picked up on it and wanted me to build a similar web-based application to cover all devices. It's now been nearly five years since I stopped maintaining it and today I want to take a look at the web app once more and assess it from what I've learned since then about web development and cybersecurity.

<!--more-->

### From passion project ...

Digitization in Germany is ... a difficult topic. It's subject to heated debates and the tedious "well we've been doing it like this for ages now, so why change it" argument. So back in my school, the most reliable way to catch up with the newest and coolest substitutions was (and still is last time I checked) a single cabinet in the main hall which contained printouts of the most up-to-date school-related information. Of course, you could also acquire this information on the school's homepage, but only after logging in, accessing the "internal" segment and clicking through a myriad of links to find out when you get to hang out with the cool substitute teacher.

The school's homepage was a pain to navigate on mobile, and even then you were presented with **all** substitutions for **all** years on **all** days of the week --- a disorganized and inaccessible nightmare. No wonder why students preferred to crowd up in the main hall and take down their timetable changes manually in their homework books with ballpoint pens.

{{< figure src="/images/vpmobil/protest.jpg" alt="Grayscale image of crowd protesting in Algeria on the street" caption="Students gather around at lunch to learn about new substitutions (source: Amine M'Siouri @ Pexels)" >}}

I had already accumulated quite some programming experience in Java at the time, and getting my first Android smartphone in 9th grade prompted me to find a way to fix this mess. I found that even though accessing the links to the substitution tables required you to login with your school credentials, the actual files containing the information were publicly accessible. They were nothing more than styled XML documents which I could just download from any client at any time. And since the files didn't change names, I didn't need to perform any mental gymnastics to always get the most up-to-date substitution plans.

So I got to work and wrote a quick and dirty Android app. It wasn't very intuitive, took some time to load but it did exactly what it was supposed to do and, more importantly, it only listed substitutions relevant to a single year. I showed it to some friends, gave them a download link and told them to report any errors back to me.

{{< figure src="/images/vpmobil/vp-apk-2013.png" alt="Android application displaying substitution plans for my school in one of its earliest versions" caption="One of the earliest screenshots of the Android app I could find" >}}

At the end of the day, the download counter for the application was at maybe five or six. The next day, it was at 20. The next day 40. Within a week, it received 100 downloads which was insane to me. It didn't take long for Apple users to complain about the lack of such an app for their iDevices, but I didn't have the capabilities of working on another dedicated app back then. I spent time after school to fix bugs, improve usability and stability. It took about a year and a half for school staff to also pick up on the app's existence.

### ... to serious business

When school staff came up to me to talk about my app, I fully expected a cease-and-desist type of ordeal considering I used a serious flaw (namely publicly accessible documents that shouldn't be) to build my app upon. Instead, they convinced one of their IT teachers (hi, Michael!) to assist me in developing a web application that would work on all mobile devices. I agreed and was given a FTP directory on the school's main server where I could host the application. Funnily enough, I wasn't chrooted to this directory, so I could read any file on the server and, coincidentally, I could also read the directory where the substitution plans were served from.

My tech stack, if you can even call it that, consisted of a heavily locked down PHP installation, vanilla JavaScript and jQuery. [You can check out the source code on my GitHub.](https://github.com/JoogsWasTaken/vpmobil) In fact, the main reason why I chose to write this article is because I wanted to archive the source code. Not even one and a half years after I graduated from school, my web app became inaccessible for no obvious reason. In that time, I switched workstations and had no copy of the source code available to me. I feared that with the web app taken down, I would have nothing to show for it. Luckily, even after having left my school over a year ago, I could still access my FTP directory with the same credentials. I sneakily copied all files onto my computer and now, since I'm afraid of my hard drive failing any day, I'm choosing to share the project with the world and preserve it.

{{< figure src="/images/vpmobil/analytics.png" alt="Graph of web app users from 2016 to 2020" caption="Web app analytics from 2016 to 2020 --- the app probably became inaccessible in 2018" >}}

I set myself a couple goals. I wanted it to feel good to use on desktop and mobile devices. I wanted it to be blazingly fast and operable even in offline mode. And finally, I (or my IT teacher more precisely) wanted it to be safe from third parties. Even five years after having last touched the source code, I can confidently say that, despite my limited programming knowledge back then, I did a pretty good job. I found some nifty workarounds for performance bottlenecks and used some rather cutting-edge web technologies back in the day to make the web app work as well as it did. And before I criticize myself, I'd like to showcase some of my favorite bits straight from the source.

### This is the part where I applaud myself

The part of the web app that students can interact with is one single PHP file. The user interface is shown below and, although it looks like a hot mess, I chose this screenshot intentionally because it shows all relevant information and controls in one screen. First off, there's a toggleable drop-down so students can select their year. Next is a sort of ribbon which shows all days of the week. The selected day is expanded and replaced with the full day, month and year.

{{< figure src="/images/vpmobil/vp-web-2016.png" alt="Web application displaying substitutions plans for my school" caption="Web application back when it was still publicly available" >}}

The red section contains important information for all years on that particular day. Lastly, there's a list of all substitutions for the selected year on the selected day. Unfortunately, you can only see one entry, but you better believe there were days when everything was filled with substitutions from start to finish. My most beloved feature is an easter egg where a sound clip saying "eight" would be played if you had a substitution in eighth period and pressed the corresponding list item in the UI. [This is a reference to the "eight game" from the Stanley Parable.](https://www.youtube.com/watch?v=fcKjg2nqXsE)

Digging through the source code, you'll see that I included parts of what could've been used to build a progressive web app back then. Most notable is the inclusion of an [application cache manifest](https://developer.mozilla.org/en-US/docs/Web/HTML/Using_the_application_cache) which has since been deprecated and is being phased out. Since I couldn't really perform any cache control with HTTP headers, I used the application cache to specify files that should be kept as a local copy should the user's device go offline. This worked surprisingly well back then. I'm unsure how well it'd work today.

{{< figure src="/images/vpmobil/dep-graph.png" alt="Dependency graph of the web application" caption="Dependency graph with all major components ... and an alienated config.php by accident" >}}

Of course, most of the heavy lifting happened in the backend. The biggest performance bottleneck by far was the extraction of information from the original XML-formatted substitution plans. I knew that there was no native XML parser in JavaScript, but I was aware it could handle JSON just fine. Closing the gap between these two data representations was a problem I spent a lot of time on. The result is beautifully overengineered and it works shockingly well.

I knew I had to leave the conversion between the two data formats up to the server. Leveraging the client would just slow it down. However, I also couldn't open the substitution plan files, parse their XML contents and return them to the client every time a student wanted to know what's up. There usually existed a plan for every day of the week. Worst case: the server would have to open and parse five XML documents one after the other and that's **slooooooow**. I needed some middle ground.

Substitution plans didn't change often; twice a day tops, but sometimes they'd remain untouched for almost an entire week. I'd have to convert the XML documents into a JSON representation at least once every time they changed. So a significant performance increase would be to perform the conversion and then store the result in a temporary file. If someone else uses the web app later and the substitution plans haven't changed, then I could just send the content of the temporary file to them.

But how was I going to efficiently determine if the substitution plans changed or not? After some digging, I stumbled upon the holy grail to solve this problem: hash functions. Before any conversion took place, I concatenated all XML documents and checksummed them. All the aforementioned temporary files are named after the CRC32 checksum of the XML files they were generated from. I kept all files in a special directory. Assume a checksum like `cafebabe`. I could just check the temporary directory listing for an occurence of `cafebabe` and, in case the file exists, send its contents back to the user. If not, I'd perform the XML-to-JSON conversion and store the result in a file named `cafebabe`.

{{< figure src="/images/vpmobil/temp-crc32.png" alt="Temporary directory listing with lots of files" caption="Interesting side effect: I own a history of substitution plans in the shape of JSON files with CRC32 names" >}}

The performance advantage is crystal clear. Now, instead of having high load times on every request due to slow XML parsing, I would only have to endure high load times once every time substitution plans changed, and low load times on any other request. And honestly, back then it was probably one of the smartest things I had ever programmed. Aside from the "eight" easter egg, that is.

I could write about other little bits that I discovered looking back at the source code, and there's probably many more design decisions that I could ramble about endlessly. But I learned a lot over the last five years and it's time to dissect some of the more glaring issues.

### This is the part where I embarass myself

Authentication is definitely the sketchiest bit about the web application. Only school staff and students were supposed to access the web app. However, I couldn't use the built-in authentication feature that was also being used on my school's website. Me and my IT teacher went for password-based authentication. At the start of every year, we'd generate a new password and tell school staff to give out the password to their students. Once the password had been successfully entered into the web app, cookies would be set that wouldn't expire for at least a year until it'd be time for a new password.

It was clear to me that having the password sitting anywhere in clear text is a terrible idea, so I came up with my own authentication handler. A file on the server contained the "main salt" and the "main hash". If a password was sent to the server, it'd be concatenated with the main salt and checked against the main hash. If the computed and the main hash matched, then I knew the user must've entered the correct password.

{{< figure src="/images/vpmobil/auth-schema.png" alt="Web application authentication schema" caption="Authentication handling (blue is stored on the server, green on the client)" >}}

A random salt was then generated for the user which was concated with the main hash and SHA256'd once more, forming the user hash. Both the user salt and hash were sent back to the user and stored as cookies. On every subsequent request, the main hash and the user salt were checked against the user hash to verify that the user is still allowed to access the site.

This worked well ... enough. The main password was never visible. However, this is terrible authentication management in any situation other than accessing your school's substitution plans. And even then, there was a major issue I couldn't avoid: the file containing the main salt and hash was **public**. I asked my IT teacher to move it to a location where it'd be inaccessible because I could do no such thing on my limited webspace, but my cries for help remained unanswered until the bitter end.

A bad actor could just read the main hash and create themselves a matching user salt and hash cookie, provided that they knew about my authorization scheme. They could even go as far as to brute-force the original password (if someone manages to do that, please send me an e-mail or [message me on Twitter](https://twitter.com/asciiowl)) if they wanted to. I was asked to keep the password as simple as possible and, if I remembered correctly, it consisted of up to eight alphanumeric ASCII characters. No promises though.

A simple improvement that I didn't think of back then would be to use [PHP sessions](https://www.php.net/manual/en/book.session.php) and disallow uninitialized session IDs. This'd thwart most attempts at forging fake authorization information. Of course, there's still the underlying issue of session hijacking and session regeneration, but I don't think protecting the substitution plans of my school would've been worth that much effort to me back then.

Code quality in general was ... okay.

{{< figure src="/images/vpmobil/if-chain.png" alt="Bad indentation in the main web app JavaScript file" caption="There's six more levels of indentation before this block" >}}

I tried to make my code reusable as much as possible. With most of my programming experience stemming from Java, I was very used to organizing my code in classes. And although ECMAScript 6 was released in 2015 with support for classes in JavaScript, I also had users who were still using Internet Explorer 10 back then. Transcompiling code with tools like [Babel](https://babel.dev/) was unknown to me. I distinctly remember reading about and trying to understand closures in JavaScript to simulate the feeling of private and public class members and functions in JavaScript. And it did work, but not without lots of headscratching and a monolithic main JavaScript file because I didn't know how to organize my code any better.

More damning is the lack of validation on all fronts. The code that handled authentication didn't verify if the cookies stored on the client could've been generated by the web app. If the XML documents hosted on the server were malformed, then the web app would break with no real fallback strategy. The same happened on the client side with the JSON-reformatted substitution plans. There was also no schema validation happening because I trusted the products of my own labor quite a lot. The list goes on, but I'm proud of what I built nonetheless.

### Practice doesn't make perfect, but slightly less jank

Five years is a long stretch of time. In the past five years, I was exposed to new programming challenges and cybersecurity concepts. You might think that I am being harsh with myself in the previous section, and I definitely am. That's because if I created a project like this with my current knowledge, then I would be absolutely ruthless and allow for no excuses. I didn't know any better though back then, and I am honestly impressed with myself and how I managed to work around most limitations I had to deal with.

This has been a passion project of mine, and I miss that feeling sometimes. There's a piece of advice my supervisor for my bachelor thesis gave me, and that is to focus on getting stuff done with new software projects, or anything really. The more you know about something, the easier it is to get lost in the details, but it also becomes harder to actually produce something others can enjoy.

This is, by no means, a call to sacrifice security for progress on your new side project. Consider its scope instead. A web app displaying substitutions plans for a school needs to work first and foremost. I had time to reflect while digging through my old source code, and going forward I will definitely focus more on getting stuff done, finishing projects, and trying to not get lost on my way there.