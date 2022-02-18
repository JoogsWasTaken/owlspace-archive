---
title: "Analyzing noscript usage, and being tracked in the process"
date: 2020-07-23 16:43:00
tags: [ "Scraping", "HTML", "Web", "Benchmark", "Data", "Analysis", "Statistics" ]
description: "Analyzing hundreds of the world's most popular websites for their usage of the noscript element, and being reminded why content blockers exist in the process."
images: [ "/images/noscript/hero.png" ]
---

When designing the theme for my personal blog, I wanted to make sure that the site would work just fine with JavaScript disabled. All kinds of scripts on this site are merely to add some neat little features here and there. However, this made me wonder about the state of the modern web and its reliance on scripts in the browser. What happens if you strip them away? I checked how websites deal with browsers that don't allow JavaScript, taking the `noscript` HTML element as my metric of choice. And although fewer websites broke than I initially suspected, it shows that you don't need scripts to effectively track people.

<!--more-->

Don't get me wrong. My intent is not to bash JavaScript as a whole. There are countless amazing applications for it which definitely improve the overall browsing experience. Yet people who block all scripts have their own reasons too, be it privacy or something else. For them, the modern web can be hostile and unusable at times.

{{< figure src="/images/noscript/gmaps.png" alt="Content that is served when browsing Google Maps with scripting disabled: \"When you have eliminated the JavaScript, whatever remains must be an empty page\"" caption="Google Maps is taunting the user with an adapted Sherlock Holmes quote when scripting is disabled: can there be a non-empty page without JavaScript? (spoiler: yes)" >}}

I ran a benchmark against 500 of the world's most popular websites and collected information about their usage of the `noscript` element. I'll be covering a lot of technicalities about my approach to collecting data. It's been my first project of this kind and I feel there's people out there who could learn from the many pitfalls I encountered. If you don't care for deep dives into data collection, feel free to skip to the [results](#general-usage-and-load-times). Otherwise, keep reading. I will be covering a lot of technical bits that went into this endeavor, describe the actual process of collecting data and my efforts of bringing said data into an easily consumable shape.

### Mastering the puppets

Before I start my rambles, I want to point you to the [GitHub repository](https://github.com/JoogsWasTaken/no-noscript) containing every single line of code that made all of this possible. You'll also find a copy of the dataset I worked with, plus several scripts to help you sanitize and work with the data. Feel free to follow along and play with it yourself. Full disclosure: I've never done a project like this before, but I have watched a couple talks by people who know better than me. So if you're one of these people, then don't hesitate to tell me how to do it better.

In order to be able to control a browser instance to suit my needs, I adopted [Puppeteer](https://github.com/puppeteer/puppeteer) as my tool of choice after much to and fro between that and [Playwright](https://github.com/Microsoft/playwright). I had some issues with Puppeteer which I later found out had nothing to do with the tool itself, but rather the revision of Chromium it was using by default. Furthermore, Puppeteer is simply the more mature choice out of the two although I'll be keeping an eye out for both as they keep being worked on.

As I mentioned, I had issues with Puppeteer's default Chromium revision meaning that I wasn't able to navigate any pages without adding the `--single-process` flag to the browser executable. This meant that I'd have to make Chromium run the renderer in the same process as the browser itself. Since I wanted something akin to a "normal" browsing experience, I opted for an earlier browser revision that'd work without any command line arguments. After all, I'm yet to see someone who downloads a browser for the first time and immediately dive into a detailed list of command line parameters. That being said, feel free to prove me wrong.

This evolved into a whole startup script that would check for available revisions, download them as needed and provide Puppeteer with the path to the browser executable. No wizardry so far until I tried to launch it on a Debian VPS I rented specifically for this project. It turns out Chromium doesn't like being run as root (rightfully so) and running it as a user requires user namespaces to be enabled in the kernel (again, rightfully so). So if you ever run into this problem, I outlined the steps to get it working in the repository to this project. The steps you need to take may and will vary depending on the type of server you're running.

### A load of loads

Now the time had come to start writing the application that would test the guts of several hundred websites. My goals were still a bit fuzzy at that point, but I had a general idea about a couple of things I wanted to accomplish.

* I wanted to test some of the world's most popular websites.
* I wanted to investigate their uses of the `noscript` element.
* I wanted to compare loading times when scripts were enabled and disabled.

I first wanted to utilize the [Alexa ranking](https://www.alexa.com/topsites) of top sites on the web. However, only 50 sites were freely available for any category and any country. I could've scraped them together but I didn't want to spend too much time curating a list of URLs. Instead, I went for the [Moz Top 500](https://moz.com/top500) which apparently uses Domain Authority as its metric to rank websites. To be honest, I hadn't heard of Moz as a company before starting this project and I still don't know how accurate the list is, but it was good enough for me since I just wanted a variety of popular websites from different countries and categories. Plus, they already handily provided a CSV file containing all URLs &mdash; enough to lift the project off its feet.

The second item from the list above was also taken care of rather quickly. I simply wanted to extract all `noscript` elements from the page I was navigating to. This also allowed me to quickly figure out if a page was using `noscript` to begin with or not. Finally, I saved the extracted HTML source to a seperate file that could be traced to the website it originated from.

And as for the load times, there's actually more options out there than one might expect. Most JavaScript developers are probably familiar with the difference between the `load` event and the `DOMContentLoaded` event. These are two events fired independently when the load state of the page that is being browsed changes. The latter is fired after the initial HTML document has been parsed while the former is fired after all resources the page depends on have been loaded. Or, more figuratively, `DOMContentLoaded` happens after the "skeleton" of the website has been loaded. Only when all scripts were parsed and executed, all stylesheets have been loaded and whatever else, the `load` event is triggered.

{{< figure src="/images/noscript/events.png" alt="Simplified graphic showing the times when browser events are fired depending on the loaded resources" caption="Overly simplified illustration of browser events for a simple HTML page with two stylesheets and one script which runs requests in the background" >}}

These are not the only two options to choose from though. Puppeteer provides two additional states called `networkidle0` and `networkidle2`. These fire 500 milliseconds after a certain maximum amount of network connections are active. So `networkidle0` would be reached 500 milliseconds after there are no more active network connections. The same applies to `networkidle2` except there can be a maximum of two active connections.

Now having all these options is great, but in the end I had to choose when Puppeteer would consider a page navigation to be finished. By default, Puppeteer waits 30 seconds for the `load` state to be reached. However, I was also curious how open network connections initiated by JavaScript or other external scripts would affect the times that I'd record. I knew that if I were to choose `networkidle0`, I would potentially end up losing a couple websites because some of them like to pull live data from another source for instance and therefore require an active network connection. Regardless, I opted for no active network connections because I wanted to find out how long it took the websites I was going to test to be fully loaded &mdash; "fully" meaning that the page would be at a standstill.

To summarize, I recorded the time it took to trigger the `DOMContentLoaded` and the `load` event. Additionally, I chose to wait until there were no more active network connections. Only then would I take another measurement before starting anew. In total, I ended up taking five measurements of every load state on every website, once with scripting enabled and once disabled.

### More considerations and more data

Another reason I chose Puppeteer over Playwright was the ability to disable caches. With the former, it's just setting a property of a page instance whereas there doesn't seem to be a straightforward way to do the same with the latter. The only mention of caches is in Playwright's habit of not sharing caches and cookies between different browser contexts which, mind you, doesn't disable caches entirely. I could've just created a new browser context for every measurement I was taking but the ease of use with Puppeteer immediately jumped out at me and made it my preferred choice.

The proverb goes "trust, but verify" so during my testing, I checked if there were truly no resources which would be loaded from cache. Interestingly enough, I found that resources which use [data URLs](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URIs) to provide their content are considered to be loaded from cache, at least with the Chromium revision that I was using. That's just a little observation on the side since it spammed my log files with warnings about cached data URLs. It's an insight that made me add a command line switch to my application to disable these kinds of warnings.

{{< figure src="/images/noscript/warn.png" alt="Console output warning about cached responses triggered by an image with a data URL" caption="Now imagine outputs like these triggered by every data URL in the wild and you can see why I made it an option to ignore these warnings" >}}

However, caches are not the only thing to consider when wanting to treat all websites equally. There's cookies, local storage, session storage, IndexedDB and a few other technologies worth pondering which can and are being used to speed up websites. Deleting all cookies from a website after visiting was fortunately solved in a couple lines of code. And while the other options I listed do exist, I'm yet to see a website in the wild which uses these technologies to actually provide a measurable advantage over other websites. Additionally, their use cases are fundamentally different from cookies so I didn't bother to deal with those.

Another source of data that I only included very late into the application were [browser metrics](https://github.com/puppeteer/puppeteer/blob/v4.0.1/docs/api.md#pagemetrics). On the surface, they look pretty neat. They give you a lot of insights into what exactly the browser has been processing. I was particularly interested in the `ScriptDuration` property which, as the documentation states, summarizes the "combined duration of JavaScript execution". I added them to the data to be stored for every page, yet I didn't go a lot further than that for reasons that I'll point out later.

One more thing before I wrap up my technical rambles. The VPS that I rented had very limited resources. I was bound to a single virtual CPU and 2 GB of RAM. I decided to launch and close Chromium for every website I wanted to test which meant that, for 500 websites, the browser would be starting up and shutting down 500 times. I could've chosen the more conservative option of taking measurements in individual pages while running one instance of Chromium at all times. However, due to an oversight in my programming (which I later fixed), Chromium ended up using 100% of the CPU at all times. In the end, it bottlenecked itself, couldn't browse the pages I wanted it to and caused thousands of lines in the error log. As a result, I added a 10 second pause after every website so I could clearly see the application working as intended in the graphs that my hosting service of choice provided.

{{< figure src="/images/noscript/stats.png" alt="Graphs of disk throughput and disk IOPS with massive spikes when Chromium couldn't navigate websites anymore" caption="Can you tell when I screwed up?" >}}

So now that I explained pretty much everything that went into the thought process of the application behind the data collection, I want to quickly summarize its workflow for every website so you can see what data is raised when and how many times. At first, the application collects some initial data about a website:

* Count the amount of `script` elements.
* Check for the presence of `noscript` elements.
* If there are any `noscript` elements, extract their content and save them to disk.
* Take a screenshot of the page and save it.
* Delete all page cookies.
* Take metrics for reference and save them.

After all that's done, the website is loaded five more times. Only load times are measured as outlined earlier, browser metrics are stored and cookies are deleted after every page visit. Then, the browser is closed and the application is run again after 10 seconds with the next website to test. If an error occurs during page navigation, a website is retried three times at max. If errors still occur, the website is skipped. 

And with that, I sent my application out to do the hard work of collecting data. After roughly six hours, I got onto the even more tedious task of making sense of what my little passion project yielded.

### Anomalies? Anomalies! Yes, of highest quality

From the 500 websites that were tested, only 352 ended up in the final dataset. This section is dedicated to the quite substantial amount of websites that didn't make the cut because, oh boy, did I spend a lot of time sifting through the data I collected. 52 of those websites weeded themselves out during data collection and the reasons why can be found in the error log of the application. Here's a selection of technical reasons why some pages aren't included:

* Too many redirects
* SSL protocol errors
* Error while resolving hostname
* Timeouts due to physical distance between VPS and webserver

The real work started when I manually reviewed the raw data. It turns out that there are a lot more reasons to exclude websites from the final results that are a bit harder for a computer to detect automatically. I grouped them into categories to see who the worst offenders were.

\# of websites | Reason for removal
--:|:--
1 | Locked out by cookie consent
2 | Caused anomalies in the dataset
2 | Shorthand URLs that act as redirects
4 | Not meant to be accessed by the general public
5 | Yahoo's many subdomains that lead to the same landing page
7 | DDOS protected sites/detected "suspicious" network activity
8 | Amazon's many storefronts for different TLDs
8 | Static service/CDN
9 | Broken, as in completely non-functioning
10 | Different TLD, same page
11 | Wikipedia's many different country subdomains

You can see the individual URLs for each category in the repository for this project. However, none of the categories came even close to the insane amount of Google products that would either show you the infamous search bar or prompt you to log in to your Google account. In the end, I had to remove 29 more URLs because they looked one like the other. I wanted to have variety in my final dataset and that's simply not a given when nearly a tenth of it is contributed by the omnipresent entity that is Google.

The anomalies didn't stop there. I already found out during my testing that, for some reason, Puppeteer sometimes doesn't report back the correct amount of `script` and `noscript` elements. It didn't happen often enough for it to become a serious problem. However, for some pages it reported that they didn't serve a `noscript` element if JavaScript was enabled but they did when JavaScript was disabled. Last time I checked, there was no reliable way to check for scripting support on the server side and serve HTML accordingly. However, take Disney's website for example which manages to accomplish exactly that. 

{{< figure src="/images/noscript/chrome-disney-js.png" alt="Indication of server-side JavaScript recognition on Disney's website" caption="Getting different results querying for noscript on Disney's website (top: scripts disabled, bottom: scripts enabled)" >}}

Feel free to educate me on that subject. I found it interesting and it has been a couple years since I checked up on server-side browser feature recognition stuff. Because of exceptions like these, I decided to let these kinds of anomalies pass. Furthermore, I counted a website towards the total of websites that use `noscript` if any one of the pages, be it with scripting enabled or disabled, sent at least one `noscript` element to the browser.

I was hoping to pull some more interesting data out of the browser metrics I collected, but their lack of documentation in the Puppeteer API and some occurences that I really can't explain made me ditch them entirely. Time durations provided by the metrics refer to some point in the past which I thought I accounted for by recording the browser metrics during the initial page scan and using them as my own point of reference for every website.

And it worked for most pages. Yet during some test runs and, inevitably, in the dataset I used for my observations, there were some outliers. In the following listing, you can see the output of my script that was meant to compute the median script execution duration in seconds for all pages with JavaScript enabled. You can clearly see that the metrics for the BBC website don't add up.

```text
bandcamp_com_js_1593693088241.json:      0.70 ['0.67', '0.68', '0.70', '0.71', '0.80']
bbc_co.uk_js_1593686327647.json:         -0.02 ['-0.17', '-0.14', '-0.02', '0.08', '0.08']
berkeley_edu_js_1593698145233.json:      0.14 ['0.12', '0.13', '0.14', '0.14', '0.16']
```

I investigated the recorded metrics for the BBC website and found that they made no real sense to me. I was originally thinking that maybe Chromium would've used a different reference point in time for every metric I ended up saving. However, the timestamps were consistent with the way they were recorded on all other websites. It was just the `ScriptDuration` property that didn't make sense. Due to lack of documentation on how the browser metrics really work, I decided to not include them in my final results.

### General usage and load times

Let's get the basics out of the way. All data that I'm presenting here was collected on July 2nd, 2020. Out of 352 of some of the world's most popular websites, I found that:

* **98.86%** (348 websites) execute JavaScript in some way, shape or form
* **58.81%** (207 websites) have a `noscript` element in their source code

Out of the websites that execute scripts, I found that **40.06%** (141 websites) do not provide a `noscript` element. This means that those pages, despite using scripts, don't use the functionality provided by `noscript` to serve alternative content or display a warning to the user. This is by no means something terrible. It is possible for a website to work just fine without scripts by using JavaScript only to provide some sort of additional, non-essential content or fluff to a page. However, websites that do rely on scripts to a greater extent and don't provide any fallback may be a bit questionable.

Regardless, I expected the use of `noscript` to be far less than it actually turned out to be. I am aware that I ran this test against some of the world's most popular pages and that the developers behind these sites will have to put a lot more thought into providing content for all kinds of users. There is a possibility that these figures change if I were to run this test against a larger amount of pages with some lesser known examples.

{{< figure src="/images/noscript/graphs.png" alt="Histograms show how long it took websites to reach certain idle states" caption="Histograms showing how long it takes for the tested websites to reach different load states depending on whether scripting is enabled or not" >}}

There isn't a massive difference in the time taken until the `DOMContentLoaded` event is fired. It makes sense because it is triggered regardless of additional resources being loaded or not. The only outlier here is Rakuten by the way which is easily explained since it's a Japanese site and simply takes a longer time to connect to as opposed to a lot of other pages in the dataset.

The same applies to the `load` event except for two more outliers: Wired and Line. Whereas Wired took consistently long to reach a loaded state, Line didn't. Sometimes it'd load very quickly and other times it carefully walked the line between getting into the dataset and being timed out. I hadn't been able to reproduce the long idle times, so take this result in particular with a grain of salt.

The biggest difference lies in the time until the idle state is reached. This should come to no surprise since there may very well be more active network connections due to scripts running requests in the background.

None of this should be groundbreaking or particularly exciting. I expected pages to load faster with scripting disabled and that is certainly the truth. Whether all tested pages are still usable under these conditions is an issue on its own. Pages that entirely depend on scripts will certainly load faster if JavaScript is disabled, but they will also become unusable as a result. And I certainly haven't figured out how to use Puppeteer to make a distinction between functioning and non-functioning sites yet, so see it as you will.

### Alternative content and pixel tracking

Now I went into the analysis of applications of the `noscript` element with good intentions which, admittedly, may have been a little naive of me. Webdev and cybersec are just two of my many guilty pleasures and I am very much aware of the many kinds of tracking being employed on the web. Yet I still went into the `noscript` analysis of 207 different websites with high hopes.

First off, let's discuss the good stuff. The first big category consists of alternative content, resources and whatever else you might want to present to the user browsing your page when they have scripting disabled. In descending order, I found the following use cases for the `noscript` element:

\# of websites | Type of content
--:|:--
40 | Static assets (e.g. images)
28 | Alternative style sheets
20 | Informative text
11 | Alternative link
10 | Inline styles
2 | Alternative content using `iframe`
1 | Alternative video

I was amazed to see `iframe` in use in the current day and age to provide some sort of navigation or interactive content. Not too long ago, single page applications were mostly built using `iframe` by simply switching out the relative URL it pointed to after a link had been clicked. Subframes have been mostly replaced by other interactive solutions over time, so I was delighted to see it in use in a `noscript` context. These two pages are the homepage of Berkeley University ([berkeley.edu](https://www.berkeley.edu/)) and the Japanese web portal Excite ([excite.co.jp](https://www.excite.co.jp/)).

Now you might think that the numbers in the list above are a bit low compared to the whole lot of 207 websites that I was analyzing. I certainly thought so. This is because the second, even bigger category concerns itself with analytics, telemetry and tracking. It may be worth taking a quick dive into the ways of tracking users on the web.

JavaScript in the browser offers ways to query lots of data about the browser, its user and sometimes even the underlying hardware. So what's left when you take all that away from the corporate giant that wants to trace your every step? The solution is to scrape whatever you can get from the raw HTTP request to the server that's hosting the website of choice. There's still plenty of information to be had, namely the user's operating system, browser, time and date, accepted languages, cookies, the page they're on and a lot of other technical bits.

But that's not all. You can also check the time of the request to create a browsing profile of the user. If the collection of requests spans over multiple webhosts, you may even be able to infer some greater insights into the the user's personality and interests based on their browsing patterns, time of stay on a website and much more.

And because that's a lot of data to process if you browse one or multiple popular websites and their pages quite intensively, the work of accumulating and making sense of this data is usually left to companies that have specialized in it. These companies usually offer a "tracking pixel". It's an image which is one pixel in size, thus not noticeable by the user browsing the page. Yet it still causes the browser to launch a HTTP request against the server hosting the pixel with all the juicy data I mentioned. 

Of course, tracking pixels are not the only way to go about collecting data from the user, but it's been a very common pattern in my analysis. You'll find a couple of familiar and not-so-familiar names that provide tracking pixels or any other mean of data collection in the following table.

\# of websites | Product or company
--:|:--
105 | Google Tag Manager
45 | Facebook Pixel
21 | Scorecard Research
11 | DoubleClick (property of Google)
7 | Yandex Pixel
5 | IMR Worldwide
5 | LinkedIn Conversion Tracking
5 | Omniture Pixel
5 | Taboola Ad Tracking
4 | Quantcast
4 | TNS Counter
3 | Bing Conversion Tracking
3 | Matomo
3 | Twitter Analytics
2 | Adobe Digital Marketing
2 | Google Analytics
2 | Mail.ru
2 | Pinterest Conversion Tracking
2 | Quora Pixel
1 | AdForm
1 | Bizographics
1 | Offerlogic (760main)
1 | Spotify Metrics
1 | StatCounter
1 | XiTi
1 | Ziff Davis

This is already quite a lot, but I shortened the results for the sake of brevity. The ones I mentioned are the ones where I found evidence that some entity was in charge of accumulating browsing data for the purpose of analytics and, in a lot of cases, marketing and targeted advertising. However, there's an equally long list of sites that require more explanation.

I found out that a couple of websites, mostly serving news, host a tracking pixel on their own servers or send data off to a URL that can be traced back to a related company after performing a Whois lookup. I found this to be the case for Alexa, ABC Spain, Amazon, Archive.org, BBC, Buzzfeed, EFF, El Mundo, The Financial Times, The Guardian, Microsoft, Rambler and Timeout. In these cases, one has to have faith in their privacy policies and data regulations.

But there's even more. While I've been able to get at least some information about third parties by just performing Whois queries, I couldn't say the same about the Playstation website. It appears to send off data to a website called thebrighttag.com and a domain name lookup reveals that its owner prefers to not be disclosed. The LA-based company Signal (not associated with the messenger app) which offers "tag management" services was the only clue I could find and would most likely make sense with the URL the Playstation site pings upon visit. Make of that what you will. I skimmed the Playstation privacy policy and while they say they may combine browsing information that may make it personally identifiable, I found no mention of said company or their product.

So there we have it. The `noscript` element is mostly used for tracking people's browsing habits instead of providing fallbacks. To close this section out on a light note, I found that 44 websites send out at least one empty `noscript` element. Of course, pages can contain multiple of these tags that may very well offer fallback content. There may also be technical reasons as to why some of them are empty. Shoutouts to the Google Support page, Le Figaro and the Xbox homepage for being the only ones in the final dataset to use `noscript` but to not do anything with it.

### Conclusion

It should come to no surprise that tracking the browsing habits of users is just a thing that happens on the web, as unfortunate as it is. I can't help but feel a little bit sad about the fact that a HTML element designed to provide fallback content is overwhelmingly used for tracking purposes instead. However, and this may come as a surprise, I relate to website authors wanting to grow their audience and collecting data to find out what's hot and what's not. I don't think that responsibly collecting metrics is a bad thing to do.

Note the word "responsibly" &mdash; this is not a given when the effort of verifying that someone's responsibly collecting data is as big as what I went through over the course of this project. So instead of making fun of the most hilarious breakages due to lack of JavaScript (as I originally intended), I'd like to give credit to some websites that particularly stood out in one way or another.

Shoutouts to the Internet Engineering Task Force ([ietf.org](https://ietf.org/)), the folks over at iubenda ([iubenda.com](https://www.iubenda.com/en/)) and the public service platform of the German government ([bund.de](https://bund.de/)). I managed to easily find out that they're using [Matomo/Piwik](https://matomo.org/) as their analytics tool of choice. Its main upside is that it's open source. You set up your own analytics instance and you're in charge of the metrics you collect from the people that browse your website. I believe it's a very solid middle ground to take when you require data about your users.

{{< figure src="/images/noscript/txt.png" alt="Screenshots of websites informing the user about needing JavaScript in order to function" caption="Points for honesty go to: Box, Disqus, Imageshack, Soundcloud and Stuff (from top to bottom)" >}}

The only completely static pages in the final dataset are the Wikimedia landing page ([wikimedia.org](https://wikimedia.org/)), the GNU project homepage ([gnu.org](https://gnu.org/)), the Debian homepage ([debian.org](https://debian.org/)) and the IANA example page ([example.com](https://example.com/)). Say what you will about their design but sometimes it really doesn't need much more than a simple, plain and static page to put yourself out there.

I also found that few websites suffered a complete breakage. There's actually an astounding amount of sites that manage to look good regardless of whether scripting is enabled or not. And because that list is quite long, I'd like to point out a few examples where I found that there's absolutely no difference in appearance when all JavaScript is blocked. This group of pages includes the US Centers for Disease Control and Prevention ([cdc.gov](https://www.cdc.gov/)), Harvard University ([harvard.edu](https://www.harvard.edu/)), O'Reilly Media ([oreilly.com](https://www.oreilly.com/)) and Telegram Messenger ([telegram.me](https://telegram.org/)). There are a lot more brilliant examples out there, so please understand that I couldn't include every single one of them.

And as for the `noscript` endeavor itself, I'm fairly satisfied despite the massive room for improvement. I very much believe that one can learn things effectively if they create them from scratch. That's been my dogma going into this project which, in all fairness, turned out a lot bigger than I originally anticipated. A lot of problems could've been avoided had I estimated the project scale more realistically.

For instance, using CSV as the data exchange format between the application that creates the dataset and the scripts that evaluated it was more trouble than it was worth. A more robust alternative like SQLite would've spared me those hours that I sank into fixing the jank I caused. I also could've saved time by not just copy-and-pasting the list of URLs that I used. What I deleted in the manual review portion of my project, I could've taken care of more effectively before even letting my application loose.

I think it'd be interesting to see how the numbers that I collected change over time, so there is a chance of me coming back to this project. For now, I feel the tiniest bit of anarchy for having wasted precious computing cycles of data collection companies by unleashing my rogue browser instances onto them.