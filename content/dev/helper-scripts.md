---
title: "How a helper script choked a high-performance storage server"
date: 2020-09-24T17:38:05+02:00
lastmod: 2020-09-24T17:38:05+02:00
publishDate: 2020-09-24T17:38:05+02:00
tags: [ "Code", "Dev", "JavaScript", "Script", "Node", "Server", "Bug", "Storage", "MinIO" ]
description: "It's tempting to work as little as possible on some code that you're going to execute once in a blue moon. This is one of the many ways it could backfire."
images: [ "/images/helper/errors.jpg" ]
---

Recently I had the pleasure of helping with a research project based around machine learning that was in the final stages of development. To test the implementation, I was asked to transfer roughly 30,000 training and test images to a storage server. The server is running a [MinIO](https://min.io/) instance which, for the uninitiated, is basically an open source equivalent to Amazon S3 providing a high availability, high performance object storage. I had already worked with MinIO before and I was comfortable using it, but I was provided with a helper script written by someone in the research group that'd take care of uploading a large amount of images from a directory. Thinking that I didn't need to spend time coming up with my own solution, I quickly got to work and expected to spend maybe half an hour figuring out how the script works and uploading all images.

<!--more-->

So I did exactly that. I skimmed the script to check which parameters I needed to provide in order for it to work. I set up a local testing environment with a self-hosted MinIO instance. I picked 10 out of the 30,000 images, ran the script and it worked beautifully. No errors, no hiccups. So the next logical step for me was to run the script against the actual server that'd hopefully end up serving every single image by the end of the day. So I ran the script and ...

{{< figure src="/images/helper/snippets-run.gif" alt="Running a Python script that waits for a long time before returning with nothing useful" caption="Patience is a virtue" >}}

Nothing happened for a while. The images weren't particularly large. They all ranged about 300kB in size. I blamed my weak internet connection at first and waited patiently. And after maybe 10 seconds, the script reported that it had uploaded the first image. Then the second, then the third. Then the 257th, then the 8398th, then the 10409th, then a slew of errors indicating that the connection had been reset, then more reports of successfully uploaded images in random order, then more errors, and then the script just stopped outputting messages altogether. I received several automated mails yelling at me to fix whatever was causing the heavy CPU and RAM usage on the server. I was bewildered and immediately stopped the script.

I checked just how much came through to the server and found that approximately 2,000 uploads were finished. The masochist in me told me to just run the script fourteen more times so that, eventually, all images would end up in the right place, but the programmer in me wanted to find out what went wrong. I pulled up the script again and decided to study it a bit more intensively than I did before.

### But 1s 1t w3bsc4le?

Let's do a little challenge. The code below contains the upload function from the helper script that I used. It's modified in certain places to not infringe on the work of the original author, but it keeps the same pitfalls. There are at least three nasty errors, one of which is the sole reason why the server freaked out as much as it did. Bonus points if you manage to find it without looking up the MinIO JavaScript package documentation.

The script is supposed to upload all files from a directory which match a specific pattern. File names must start with `FOO-`, followed by an eight-digit number and ending with either `.jpg` or `.jpeg`. There may be additional characters between the number and the file extension which we don't really care about. Only files that match this pattern are uploaded to the desired MinIO instance where they are renamed to only keep the number from the original file name and the `.jpg` extension.

You don't need to know anything else that's going on in the script. We'll assume that all variables and file names are valid and all files that match the pattern above are proper JPEG-encoded images, so there are no outside influences that could mess with this script. Go ahead and try to spot as many errors as you can. The function is called as `runBulkUpload(bucketName, dirPath)` in the script.

```js {linenos=table}
function runBulkUpload(bucketName, dirPath, callback) {
    let fileNames = fs.readdirSync(dirPath);
    
    for (let fileName of fileNames) {
        const regex = new RegExp("(^FOO-[0-9]{8}*.jpg$)" | "(^FOO-[0-9]{8}*.jpeg$)");

        if (fileName.match(regex) === null) {
            return;
        }

        let filePath = path.join(dirPath, fileName);
        let objectName = `${fileName.substr(4, 8)}.jpg`;

        minioClient.fPutObject(bucketName, objectName, filePath, (err) => {
            if (err) {
                console.log(`Error in uploading ${fileName}: ${err}`);
                return;
            }

            console.log(`${fileName} uploaded successfully.`);

            if (callback) {
                callback();
            }
        });
    }
}
```

So let's get the first two, slightly less important but no less peculiar bugs out of the way. Note the regular expression on line 4: `^FOO-[0-9]{8}*.jpg$`. It looks for `FOO-` at the beginning of a string followed by eight digits. So far so good. But then it's followed by the asterisk quantifier `*` which asks for unlimited occurences of ... what exactly? The asterisk doesn't come after a quantifiable expression like a character class so this is an invalid regular expression. It's more likely that the author meant to write `.*` which would be asking for any amount of any character, as long as it ends with `jpg`. But even then it'd miss a dot in front of the file extension so the intent behind the regular expression as it stands is kind of ambiguous. So if it's an invalid regular expression, then why does the script compile it with no errors?

I didn't notice it at first but have a look at the string given to the `RegExp` constructor. Maybe you got fooled like I did and thought that the pipe character `|` was part of the regular expression. But as it stands, it acts as a bitwise OR between two strings. In JavaScript, an OR between non-numeric strings (yes, this is [well-defined according to the spec](https://www.ecma-international.org/ecma-262/5.1/#sec-11.10)) is evaluated as zero. Now this is brilliant because the regular expression consequently checks for occurences of a literal `0` in a file name which, by coincidence, is a condition that all image files that are meant to be uploaded fulfill. The images are numbered in ascending order. There's 30,000 of them and there's eight digits available, so the first three digits will always be zero. So this is either just dumb luck or 5D chess being played right in front of my very eyes.

### Unintended denial of service

Now to the star of the show. A lot of JavaScript developers will be familiar with the term "callback hell" which is a mark of poorly handled asynchronous JavaScript. Before [promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) were a thing, the results of asynchronous function calls were usually caught using callback functions. This means that an asynchronous function doesn't return its results immediately but rather provides them as arguments to the callback function. Therefore, the main execution context doesn't get blocked and we receive the results once they're available.

If you think of code as something that is executed from top to bottom, it is very easy to get lost in a series of callbacks that, for some reason, magically accomplish what you want them to do but leave you with a rat's tail of closing brackets that make it hard to follow which bracket belongs to which block.

```js
doAsyncThing(fooArg, function (err, resp) {
    if (err) { console.log(err); return; }

    if (resp === true) {
        doAnotherAsyncThing(barArg, function (err, resp) {
            if (err) { console.log(err); return; }

            fooArg += resp;
        });
    } else {
        doAsyncThingBeforeAnotherAsyncThing(barArg, function (err, resp) {
            if (err) { console.log(err); return; }
            if (resp !== "ok") { 
                console.log("fix later"); return;
            } else {
                doAnotherAsyncThing(barArg, function (err, resp) {
                    // FIXME where am i again?
                });
            }
        });
    }

    console.log(fooArg); // TODO i don't think this outputs the right result
}); // sad bracket );
```

Keeping track of callbacks can be very cumbersome if handled improperly, and this is my guess as to what went fatally wrong in the script I was given. `fPutObject` on line 14 is an asynchronous function, recognizable by the last parameter which is a callback function that eventually gets called to indicate whether the upload was successful or not. However, the loop that iterates over all file names doesn't wait until the upload of an image is done. In fact, with the way the `runBulkUpload` function is called as pointed out earlier, the check for the `callback` variable does nothing.

So what happens? The loop keeps running without waiting for uploads to be finished and therefore keeps creating new upload requests, hundreds, maybe even thousands of requests a second &mdash; a classic denial-of-service attack using up a sizable amount of network bandwidth. At some point, the MinIO instance can't keep up, runs out of RAM, aborts and resets connections if they haven't timed out by the point they reach one of the few open ports.

It worked in my local testing environment because I was only running 10 upload requests in parallel which was more than manageable. What baffled me is that, supposedly, the people I got the script from ran it on their infrastructure with the same dataset and with no errors or hiccups. That's either some beefy hardware or the work of someone who went the masochistic route.

### Digital whodunnit

So who's at fault here? Is it the author for not implementing sequential uploads correctly or providing a sensible option for parallel uploads? Or is it me who just had a quick glance at a script written by people I didn't know personally and thinking I'd be fine? As with many things in life, I think the answer lies somewhere in the middle.

The script was part of a major well-written and well-structured project that had quite a bit of development time and cost behind it. The images I had to upload were merely a tiny step in the grand scheme of things so I assumed there wouldn't be any harm in just taking what I was given instead of reinventing the wheel. Plus, I didn't bother testing the script locally with all of the 30,000 images. I tried it after the fact and, unsurprisingly, I ran into similar issues with a MinIO instance on my local machine. The only difference is that I got rate limited before I ran out of resources.

On the other hand, an accidental denial-of-service is higher up on the list of things that can go wrong in software development than most other things. The script contained some other bits here and there that were just ... odd, for lack of a better word. It either meant that the author rushed the creation of the script or wasn't too familiar with what JavaScript and Node.JS can offer. I did my part, rewrote the script and handed my changes in. It reliably breezed through the entire set of images in a couple of minutes.

{{< figure src="/images/helper/failing.webp" alt="Snippet from Louis Cole Live 2019 \"Failing but in a cooler way\"" caption="Mandatory listen: Failing in a Cool Way (Live 2019) by Louis Cole" >}}

So what's the moral of the story here? The images were eventually all uploaded, right? The storage server wasn't used by anyone else and therefore not part of critical infrastructure. And I wasn't on a serious deadline either. I had more than enough time to fix the upload script. All of these conditions are exceptions and not the norm everywhere else. I crunched the numbers and I ended up spending roughly six times longer on this problem compared to the scenario where the script would've worked out of the box. This is a big factor when deadlines are an issue.

So to all my fellow code authors: treat your helper scripts like you'd treat the code base it belongs to. It is very tempting to scratch the bare minimum for a piece of code that you're only going to execute a handful of times in the foreseeable future. And to my fellow helper script users out there: take your time to verify that it works the way you expect it to. Make sure it stands the workload you're going to put it through. I'm not going to act like I haven't been lazy with helper scripts before, but this example really put the extra amount of work caused by a couple of errors in a few lines of code into perspective for me.