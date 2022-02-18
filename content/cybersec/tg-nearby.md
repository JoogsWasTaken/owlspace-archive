---
title: "Modifying Telegram's \"People Nearby\" feature to pinpoint people's homes"
date: 2021-02-05T13:03:01+01:00
tags: [ "cybersec", "telegram", "location", "gps", "python", "java", "oss", "open souce", "trilateration" ]
description: "A new way for script kiddies to find out where you live as opposed to \"hacking your IP address\"."
draft: false
images: [ "/images/tg-nearby/hero.png" ]
---

One morning I woke up and found that Telegram implemented a new feature called "People Nearby". If you choose to share your location publicly on Telegram, you'll appear in a list for users who are physically close to you. Not only that, but they'll also see just how far away you are down to the meter. However, you don't need to share your own location in order to see where people around you are located. These are perfect prerequisites to find out just how accurate this feature really is and, more importantly, whether or not it can be used to find out where nearby Telegram users live.

<!--more-->

### Privacy 101: Your location isn't anyone's business

If you've never heard of this feature and you suddenly feel the urge to delete your Telegram account forever, let me stress something very important: **"People Nearby" is opt-in**. By default, no one can see how far away you are on Telegram. You'll only ever end up in other people's lists by pressing the "Make Myself Visible" button. If you choose to try it out, remember to disable it once you're done.

{{< figure src="/images/tg-nearby/share-publicly.png" alt="Telegram's prompt to share your location using the \"People Nearby\" feature" caption="JUST DON'T PRESS THIS BUTTON OKAY?" >}}

Once you share your location, every nearby Telegram user will be able to look at your profile. This may include, **if explicitly specified in your privacy settings**, your user handle, your first and last name, your phone number, your bio and all your profile pictures. People will see exactly how far away you are. Strangers may message and call you. It is also worth noting that "People Nearby" allows you to see public groups in your proximity. Again, any user may read all messages, view all shared media and links and see all group members without actually joining the group. Joining is only necessary for active participation.

**Do not make yourself publicly visible on Telegram unless you have a very, very good reason. Be aware that you'll end up exposing a significant amount of personal data to the people around you.** I assume that the majority of people who will be reading through this article are privacy-aware to some extent, and I can only call on people's rational thinking to treat this feature with the care that it requires. Be safe out there, people!

### A feature begging to be exploited

There have been many different tech outlets warning about the dangers of the "People Nearby" feature almost immediately after it was introduced. [Ahmed's Notes](https://blog.ahmed.nyc/2021/01/if-you-use-this-feature-on-telegram.html) was one of the first to report its implications to the public and to Telegram's bug bounty program. Telegram later responded saying that the feature is working as intended, and that users must explicitly consent to having their location shared with others around them. So as it stands, it's a feature that is likely to stay.

{{< figure src="/images/tg-nearby/ahmed-location.png" alt="Screenshot of Ahmed's Notes on Telegram's \"People Nearby\" feature, showcasing how to determine strangers' locations" caption="In fact, they use a similar method compared to what I'm going to present in this post, except I'll be supercharging it" >}}

Whether you agree with how the "People Nearby" feature works is up to you. I will be sharing my personal thoughts at the end of this post. Regardless, I want to go on a quick tangent before I delve into the nerdy stuff. As mentioned at the beginning, I stumbled upon this feature randomly and found myself wanting to know how it works. I messaged my roommate about it who stayed in a different city back then. And within a few minutes, I found a new entry at the top of my list of nearby people: my roommate.

He had spoofed his GPS location on his phone to put himself six meters away from me. He then shared a screenshot of the app he used to fake his location and, indeed, he put himself right into my bedroom. This meant that not only was the distance shown for every user pretty accurate, but it also updated very frequently. I'm using the word "was" here because Telegram made the decision to not display any distances below 100 meters since then. However, we'll soon find out that this is just a drop in the ocean, and that the accuracy we lose because of this change is easily regained.

### Everything at our feet

[Telegram's Android messenger](https://github.com/DrKLO/Telegram) is, like most of its core components, open source. This means that everyone can peek into the source code, copy it, edit it and create their own version of the Telegram app with whatever features they need. In Android, user interfaces and functionalities are organized into so-called activities. As such, the "People Nearby" feature finds itself in the [PeopleNearbyActivity](https://github.com/DrKLO/Telegram/blob/eb2bbd32c17fa7f50009404f73b8a6a630f31bfb/TMessagesProj/src/main/java/org/telegram/ui/PeopleNearbyActivity.java).

The code that requests a list of nearby users resides in the `sendRequest` function. It is called pretty much everytime the activity is navigated to and whenever the app receives a location update. The time period between location updates is ultimately decided by the operating system, but the Telegram Android app requests to receive updates as soon as possible.

```java
/*
    this code can be found in the LocationController class.
    here, the app requests to receive location updates whenever
    the users moves at least 1 meter, or after 0 milliseconds.
    so basically, this is screaming "give me updates whenever you can".
    see: https://developer.android.com/reference/android/location/LocationManager#requestLocationUpdates(java.lang.String,%20long,%20float,%20android.location.LocationListener)
*/
locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1, 0, gpsLocationListener);
```

When `sendRequest` is called, the app uses the last known device location and sends it off to Telegram's servers. In return, the app receives a list of nearby entities. In addition to their unique Telegram IDs, these entities also contain their distance in meters to the submitted coordinates as well as an expiration timestamp. From what I found out, users who share their location publicly will have their expiration timestamp set to the maximum signed integer value `0x7fffffff`, meaning they technically "never" expire.

The app then iterates over all received entities and puts them into a list of either nearby users or groups. Since I'm only interested in the former, I can just add my code before or after users are added to their respective lists. Fortunately, the Telegram source code contains a class called [FileLog](https://github.com/DrKLO/Telegram/blob/99f5637dda59bc405734342d3e2448701d63f2d3/TMessagesProj/src/main/java/org/telegram/messenger/FileLog.java) which prints debug information to the system log as well as a file log located on the device's external storage, if present. So all I had to do was to dump the user entity information to the file log on every location update.

```java
TLRPC.User user = getMessagesController().getUser(peerLocated.peer.user_id);
FileLog.d(String.format(Locale.ENGLISH, 
    "peer update [distance=%d, id=%d, displayName=\"%s\", expires=%d]", 
    peerLocated.distance,           // distance in meters
    peerLocated.peer.user_id,       // telegram id
    UserObject.getUserName(user),   // displayed name
    peerLocated.expires));          // expiration timestamp
```

Additionally, I logged the location that triggered the request for nearby users with everything the [Android Location API](https://developer.android.com/reference/android/location/Location) offered. Then it is as easy as following the instructions in the Telegram Android app repository to install my custom Telegram version onto my Android device. I then wrote a short Python script to feed the data I accumulated into a SQLite database to run some queries on it later.

### Excellent math in an imperfect world

So now we have the ability to feed all data that "People Nearby" provides into a database. How do we find ~~hot~~ Telegram users in our area? Let's assume that we live in a perfect world where there's no measuring inaccuracies whatsoever. Let's also assume that the earth is a plane (unless you're a flat-earther, in which case you don't need to perform any extra mental gymnastics). If we're trying to find the coordinates of one particular user, then we need to look at how far away they are at every logged location.

The process of solving for a point's coordinates given a set of known points with known distances to that particular point is called trilateration. At every recorded location, we can imagine a circle with the radius of the distance to the unknown point. Ideally, all circles will then intersect at exactly one point which is the one we're looking for. However, to find a concrete solution, we need at least three points in a plane in order to solve this problem.

{{< figure src="/images/tg-nearby/trilateration.png" alt="Trilateration with three known points for an unknown point in a plane, perfect intersection on the left, overlaps on the right" caption="Trilateration in a perfect world (left) and in our world (right)" >}}

But we don't live in a perfect world. The earth is not flat (what a shocker!) and GPS coordinates always have some sort of inaccuracy. This means that our own and other users' locations mustn't be accurate. The circles, which are actually ellipses once mapped onto the earth's surface, won't intersect in one location, if at all. We're more likely to get an area where a lot of our known ellipses overlap as opposed to a definitive point on earth's surface. And to top it all off, we can't be sure that Telegram is actually providing us with accurate measurements.

Luckily, all this is no big deal. Let's think back to locations as points on a plane. If we were to make an educated guess as to where the unknown point could be, then its distance from our known points will deviate from the distances we recorded. This is an error that we can calculate and all of a sudden, the task of finding a point's coordinates on a plane turns into an optimization problem. We're trying to find a point such that the computed distance error is minimal.

{{< figure src="/images/tg-nearby/trilateration-mse.png" alt="Trilateration but taking a guess for the unknown point, resulting in differences between measured and computed distance" caption="Notice how the guessed point doesn't align perfectly with the measured distances" >}}

Such an optimization method is minimizing the mean squared error. There have been countless explanations of this method in particular and I won't be covering how or why it works. Instead, I recommend you read [this article](https://www.alanzucconi.com/2017/03/13/positioning-and-trilateration/) by Alan Zucconi who explains the math and its implementation in Python at the example of --- you guessed it --- trilateration. Instead, I want to touch on one more problem I encountered before delving into the fun part of visualizing all the collected data.

I said at the beginning that Telegram won't show distances below 100 meters. If someone is within your 100 meter radius, Telegram will simply report them being 100 meters away for you, no matter how close they are to you. This appears not only on the frontend, but also on the backend. Telegram's servers won't go below 100 meters when returning a list of nearby users. This is a problem, because if someone were to stand right next to me, I'd suddenly have to deal with a very significant error were I to take Telegram's reported distance for granted.

From now on, I'll be calling locations at which I recorded a user being less than 100 meters away from me simply "100s". These 100s have the property of being geographically close to the user, but the associated distance is no use due to the lower cap imposed by Telegram. As such, I chose to not use these 100s for location estimation, but rather to perform an initial guess for the mean squared error optimization. If there are no 100s for a specific user, I'd simply choose the location with the lowest reported distance as a starting point.

That's enough math for now. If you're curious about the exact implementation, you can always check the [repository](https://github.com/JoogsWasTaken/tg-nearby) for this project. It's time to get to the most exciting part of this journey.

### Markers, circles and scary predictions

I sunk the most amount of time into creating a browser-based interface to navigate through the collected data. All locations where the Telegram app received a location update are plotted onto an interactive map. A small control panel in the top right allows for the selection of individual users, adjustment of parameters for the estimation of a user's actual location, and rendering options because drawing maps in the browser isn't exactly inexpensive. The following screenshots show the user interface in action, with a dataset that I accumulated on a Sunday afternoon walk. Note that all user handles are blacked out.

{{< figure src="/images/tg-nearby/ui-overview.png" alt="Web interface overview with a dataset loaded in" caption="Web interface showing my Sunday afternoon walk" >}}

Every location marker has a red circle underneath. Its radius is equivalent to the corresponding recorded horizontal accuracy. Throughout my dataset, I found that the horizontal accuracy averaged at around 12.8 meters. On my 45-minute walk, I managed to get data from 205 distinct locations, averaging at around 13.3 seconds between location updates. Keep in mind that's up to 100 nearby users every time my location noticeably changes --- quite a lot of data for such a short walk.

The fun, and admittedly slight scary part, begins when querying for distinct users. As shown in the illustrations from the previous section, the circles, whose radii are equal to the distance to a selected user, are drawn onto the map. This is to get a rough feeling as to where the user might be located. If there are any locations at which a user has been recorded being 100 meters or less away, then the corresponding marker is colored red. The computed location estimate is displayed with a glorious golden marker. When clicked, it shows the exact latitude and longitude.

{{< figure src="/images/tg-nearby/ui-location.png" alt="Web interface overview with a user selected" caption="It appears that ██████████ is all about the urban experience" >}}

I found that the golden marker always landed on some building or property with a house number nearby. There were very few exceptions, and it didn't seem to matter if users were reportedly one or ten kilometers away from me. Even though I exclusively walked along streets and sidewalks, the aforementioned optimization method allows to pinpoint a location where someone could very well be going about their daily life.

You might've already noticed the orange marker in the above screenshot. These markers are meant to attribute some cardinal direction to users who are very far away. Locations are internally sorted by distance in ascending order. The first few locations in this list, 100s included, have their corresponding markers appear in orange on the map. In the following screenshots, you'll find that the orange markers are pointing south. The golden marker verifies that.

{{< figure src="/images/tg-nearby/ui-faraway-far.png" alt="Web interface in use to find the location of a faraway user, zoomed out" caption="Attempting to find a user who's significantly further away ..." >}}

{{< figure src="/images/tg-nearby/ui-faraway-near.png" alt="Web interface in use to find the location of a faraway user, zoomed in" caption="... and finding a suggested location in some rural town with a precise street number" >}}

Without any numbers to go off just yet, it's pretty clear that simply observing where the circles overlap allows one to narrow down a user's location pretty tightly, far below the 100 meter barrier imposed by Telegram. Combine that with the estimated location and you have yourself a handy starting point. All that's left to do is to go there, check mailboxes and their corresponding nameplates to see if any of them match up with the Telegram user handle of your choice.

Now it looks pretty good but does it actually work? Is the presented information enough to find any user's location with reasonable accuracy? I got my roommate to help me figure this one out.

### Numbers speak louder than words

It was my roommate's job to spoof his GPS location once more and make himself publicly visible. Then I went for another walk, imported the data, let my computer crunch the numbers and give an estimate on his whereabouts. We then compared my guess with his real location. The path I walked is similar to the one shown in the screenshots above, except I intentionally focused on trying to get as close to his faked location as possible. In the following image, the yellow marker represents the estimated location based on the data I collected. The blue marker was my roommate's actual location.

{{< figure src="/images/tg-nearby/ui-test.png" alt="Web interface showing estimated and real location in real-life test close nearby" caption="Ladies and gentlemen, we got him" >}}

The weather wasn't great and I never got within his 100 meter radius. Regardless, I ended up being off by merely 16.3 meters with the standard parameters. By decreasing the maximum accuracy for GPS fixes down to 15 meters, I was able to shave another meter off the final result. This was only possible because my recorded GPS coordinates were a lot more accurate compared to my Sunday afternoon dataset.

You may be skeptical and think that this is just a lucky hit, and I wouldn't blame you for that. Throughout my collected datasets, I picked out three names that sounded like they could belong to real people, meaning no acronyms or obvious nicknames. I did some more location estimates for these people and went for another walk to check if I could find any doorbells with their names on them.

I was only able to do so for one user who verifiably had their last name as their Telegram user handle. Their estimated location ended up being off by less than ten meters. I couldn't find any real-life references for the other two people, not even after checking every house in their presumed neighborhood. This probably meant that their user handles were indeed fictional despite sounding like they could be real.

Regardless, it is difficult to verify the correctness of this method with people I don't personally know. I can interpret where the circles on the map overlap and then judge whether the yellow marker could be a reasonable guess or not. With my roommate, I could actually verify and measure just how close I was. And after having spent this much time with the "People Nearby" feature, I came to the conclusion that the data that Telegram provides about nearby users is more than enough to significantly reduce the area in which a person could be located.

### Final thoughts

I collected data in a town that is not very densely populated and where not many active Telegram users live. My list of nearby users has been thoroughly manageable. Therefore, I can't make predictions on how well this method works in large towns with high population density. I assume that results may vary in a busy city with probably less accurate GPS results, but due to the state the world is in as of writing, I can't really put it to the test.

I promised I would offer my own thoughts on Telegram's "People Nearby" feature. For one, I think Telegram's point about users having to consent prior to sharing their location is perfectly valid. However, I believe that this is an exceptionally unneccessary feature for an app that prides itself with caring about their users' privacy. You may think that it's the users who are at fault since they're willingly publishing their location, but I don't think that it matches Telegram's philosophy at all.

What bothers me the most is that one can passively snoop on nearby users without effort and without ever sharing their own location. A bad actor could just use any fake GPS app to find out where people live worldwide. They could use the exact same methods I described in this post to circumvent the 100 meter restriction and get some very close estimates. And if they're somewhat technically adept, they could modify the "People Nearby" function to not depend on the device's location at all --- GPS spoofing straight at the literal source. 

{{< figure src="/images/tg-nearby/distance-terms.png" alt="Idea of using \"close\", \"far away\" and \"very far away\" as terms to describe distance in different environments" caption="A crude schematic of what distance descriptions might look like depending on environment" >}}

But since I already said at the beginning that this feature probably won't get removed, I'd like to offer a potential solution. Instead of showing distance in meters, Telegram could benefit by using vague terms like "close", "far away" or "very far away". The usage of these terms shouldn't depend on fixed distances, but rather environmental factors. "Close" in a densely populated area is a lot less meaningful than "close" in a rural town if we're using fixed values to determine proximity.

Sure, Telegram might opt to add some noise to the distances they show, or group people together if their distances are close to one another. I suspect the Telegram developers might have already implemented something similar. I found a couple cases in my datasets where Telegram reported multiple people being the exact same distance away from me. But then again, the math to cancel out or reduce noise is there. I believe that this can only be properly fixed if Telegram chooses to not disclose distances in any unit of length.

I can only encourage you to [have a look at the source code](https://github.com/JoogsWasTaken/tg-nearby) that goes along with this article so you can try it out yourself. I would be very happy to hear back from you with your own findings and thoughts on this undertaking, either via mail or on [Twitter](https://twitter.com/asciiowl). I tried to make it as accessible as I could, but you will still require some technical knowledge to get it working. Have fun poking around your neighborhood while you still can, and let's cross our fingers that Telegram will change something about this very broken feature.