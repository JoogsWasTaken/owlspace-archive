---
title: "Pulling apart the 100% characteristic of FEAL-4"
date: 2020-05-12 19:13:00
tags: [ "Cryptanalysis", "Cryptography", "Math", "FEAL", "Cipher" ]
description: "A deep dive into the FEAL-4 characteristic that's guaranteed to work."
images: [ "/images/feal-4/scribbles.jpg" ]
katex: true
markup: mmark
needsjs: true
---

FEAL-4 provides as gentle of an introduction to differential cryptanalysis as there could possibly be. Hence I found myself a little disappointed at the lack of freely available documentation on that subject. You'll find research papers which (rightfully so) appear very abstract and complex. And if you're a crypto noob as much as I am, then these resources won't help you much or, even worse, discourage you. In this article, I want to sacrifice scientific accuracy for comprehensibility and share my own view on one of the most intriguing aspects &mdash; at least in my opinion &mdash; of the differential cryptanalysis of FEAL-4.

<!--more-->

Before we start, I would like to give a shoutout to [Jon King's tutorial](http://theamazingking.com/crypto-feal.php) on the cryptanalysis of FEAL-4. During my research, I found it to be one of the most comprehensive and understandable walkthroughs out there. Furthermore, he deals with the entire cryptanalysis whereas I will only dissect one aspect of it. His explanations are a lot more technical whereas I will be going on a more mathematical tangent. Once you're done reading this article, I highly recommend checking out his too.

We will be having a short look at the structure of the cipher and state the main reason why we'd want to prefer a differential over a linear analysis. The main section of this article will be dealing with the characteristic mentioned in the title and, more importantly, why it works. Finally, we take a look at how one would be able to come up with such a weird concept themselves.

### A short overview of FEAL-4

FEAL-4 is a block cipher first published in 1990 as an alternative to the Data Encryption Standard that is faster to compute with overall decent security (needless to say that no longer applies). It works on blocks of 64 bits and has four rounds. A 64 bit key is required which is expanded into six 32 bit subkeys. The overall structure is shown in the image below. The subkeys are denoted $K_0$ to $K_5$. $P_L$ and $P_R$ are, respectively, the left and the right half of the plaintext block. The same applies to the two halves of the ciphertext block $C_L$ and $C_R$.

{{< figure src="/images/feal-4/diagram.png" alt="Diagram of the FEAL-4 cipher" caption="Structure of the FEAL-4 cipher, adapted from &quot;Applied Cryptanalysis &mdash; Breaking Ciphers in the Real World&quot; by Mark Stamp and Richard M. Low" >}}

The round function $F$ takes 32 bits of input and produces 32 bits of output. Let's call the input $X$, then we can split it up into four chunks of eight bits. Throughout this article, we will denote those individual bytes with indexed lowercase letters. So when we speak of $X$, we can also see it as its individual bytes $x_0$ to $x_3$.

The $\oplus$ in the image above represents, just like in the FEAL-4 diagram, an XOR operation. All that's left are the boxes labelled $G_0$ and $G_1$. They represent two functions, each taking two 8 bit inputs and producing one 8 bit output.

$$\begin{aligned}
G_0(a,b) &= (a + b\kern-1em\,\pmod{256}) \lll 2 \\
G_1(a,b) &= (a + b + 1\kern-1em\,\pmod{256}) \lll 2
\end{aligned}$$

Both $G_0$ and $G_1$ add their inputs together. The latter adds one on top of the result. Then, the sums are taken modulo 256 so they stay in the range of 8 bits. Finally, a cyclic left shift is performed. It behaves like a normal left shift except the bits that would be cut off due to the 8 bit output requirement are fed back into the other end.

Tracing the lines of the round function diagram, we can figure out how the output bytes are computed. In the following set of equations, you'll find that the output bytes are not in numerical order. This is not to annoy anyone (I probably changed the order five times in the process of writing), but you'll notice that all output bytes except $y_1$ depend on previously calculated output bytes. So as opposed to their natural order, you'll find them in the order they are computed in.

$$\begin{aligned} y_1 &= G_1(x_0 \oplus x_1, x_2 \oplus x_3) \\ 
y_0 &= G_0(x_0, y_1) \\ 
y_2 &= G_0(y_1, x_2 \oplus x_3) \\ 
y_3 &= G_1(y_2, x_3) \\ 
\end{aligned}$$

This is everything we need to know about the cipher for now. We will be revisiting the round function and, more specifically, the $G_0$ and $G_1$ functions later when we find out how they make the cipher crumble when subjected to differential cryptanalysis. However, we should consider why we'd prefer to take a differential as opposed to a linear approach first.

### Differentials make a difference

In differential cryptanalysis, we search for so-called characteristics. They can be loosely described as input differences which are somehow advantageous to the cryptanalyst with some probability. This definition is intentionally vague because the kind of "difference" and "advantage" ultimately depends on the cipher that is being analyzed. For FEAL-4, we say that the difference is XOR and the advantage is leaking information about the key. We're basically conducting a chosen plaintext attack where we encrypt a pair of plaintexts satisfying a particular property using the same key. Through some weakness within the cipher's design, we're eventually able to consider some candidate keys.

{{< figure src="/images/feal-4/differences-01.png" alt="Result of two simultaneous XOR operations with one shared value" caption="Two XOR operations running in parallel with one shared value" >}}

Take another look at the diagram for the FEAL-4 cipher and you'll find that its input, before being processed by the round function, is XORd with the subkey for that round. Now imagine two instances of the cipher running in parallel using the same key but different plaintexts. If we were to take the difference of the round function inputs, then we'd find that the subkey is cancelled out since both inputs share the difference caused by the same subkey. This means that by calculating the difference, we're XORing the subkey with itself which causes it to cancel out. This leaves only the difference caused by the specification of our plaintexts.

{{< figure src="/images/feal-4/differences-02.png" alt="Difference of previous two simultaneous XOR operations" caption="Difference of previous XOR operations (computation on the top, result on the bottom)" >}}

This might seem counterintuitive at first because retrieving information about the subkeys is what we want and we're basically getting rid of them. However, a good characteristic will allow us to simply skip over one or several rounds. We will eventually use our knowledge of input and their corresponding output differences to effectively search for some candidate keys and trace our way back through the cipher which, in theory, should be a lot easier with parts of the key recovered.

With FEAL-4, there exists a characteristic that skips the first three rounds, effectively only leaving the last round to find putative subkeys for. If we have two round function inputs $A$ and $B$ which satisfy $A \oplus B = \texttt{0x80800000}$, then the following can be shown to be true 100% of the time.

$$F(A) \oplus F(B) = \texttt{0x02000000}$$

We will be proving this property, but first we will be laying down some basics as well as defining our goal a little more clearly. 

### One problem becomes four

We have a specific condition that needs to apply to our input pair $A$ and $B$. Having XOR as our difference operation is convenient because we can use our characteristic to express $B$ in terms of $A$.

$$\begin{aligned}
A \oplus B &= \texttt{0x80800000} \\
B &= A \oplus \texttt{0x80800000}
\end{aligned}$$

We already saw that the round function works on bytes as opposed to the entire 32 bit input, so let's look at what this means for the individual bytes of $A$ and $B$.

$$
\begin{aligned}
b_0 &= a_0 \oplus \texttt{0x80} \\
b_1 &= a_1 \oplus \texttt{0x80} \\
b_2 &= a_2 \oplus \texttt{0x00} = a_2 \\
b_3 &= a_3 \oplus \texttt{0x00} = a_3
\end{aligned}
$$

Now let's define our 32 bit outputs as $X$ and $Y$ respectively. This means that $X = F(A)$ and $Y = F(B)$ and therefore we want to show that $X \oplus Y = \texttt{0x02000000}$. We can do the same thing we did to our round function inputs and see what that means for the individual output bytes.

$$
\begin{aligned}
x_0 \oplus y_0 = \texttt{0x02} \\
x_1 \oplus y_1 = \texttt{0x00} \\
x_2 \oplus y_2 = \texttt{0x00} \\
x_3 \oplus y_3 = \texttt{0x00} \\
\end{aligned}
$$

I'll be referring to $x_0$ and $y_0$, $x_1$ and $y_1$ and so on as pairs that are meant to fulfill the conditions we've just stated. Before we dive into the proof, there's one thing left to note. Most pairs, when XORd together, should equal zero. This can only be true however if their values are equal to one another. For example, consider the second line which effectively means that $x_1$ and $y_1$ must be equal for their difference to be zero. 

So our goal is to prove all four equations above. If we can manage that, then we have shown that the characteristic holds.

### Making the cipher crumble

We will soon see that the round function crumbles very quickly, no matter how complicated the computation of the output bytes might seem at first. Since $x_1$ and $y_1$ will be the first output bytes to be computed, let's have a look at how they are constructed. Keep in mind we want to show that $x_1 \oplus y_1 = \texttt{0x00}$ which, as we discussed earlier, can only be true if $x_1 = y_1$. Also remember how we expressed every byte of $B$ in terms of $A$.

$$
\begin{aligned}
x_1 &= G_1(a_0 \oplus a_1, a_2 \oplus a_3) \\
y_1 &= G_1(b_0 \oplus b_1, b_2 \oplus b_3) \\
&= G_1(a_0 \oplus \texttt{0x80} \oplus a_1 \oplus \texttt{0x80}, a_2 \oplus a_3) \\
&= G_1(a_0 \oplus a_1, a_2 \oplus a_3) \\
&= x_1
\end{aligned}
$$

This one fell apart rather quickly. We just substituted every $b$ with our expressions using $a$. The $\texttt{0x80}$ conveniently cancels itself out, so we find that $x_1$ is computed in the exact way as $y_1$ and therefore $x_1 = y_1$. One down, three to go. Let's observe $x_2$ and $y_2$ next and we'll find that their equivalence is proven just as easy as with our previous pair of output bytes.

$$
\begin{aligned}
x_2 &= G_0(a_2 \oplus a_3, x_1) \\
y_2 &= G_0(b_2 \oplus b_3, y_1) \\
&= G_0(a_2 \oplus a_3, x_1) \\
&= x_2
\end{aligned}
$$

In addition to replacing all our $b$ bytes with $a$ bytes, we can now use the fact that $x_1 = y_1$ in our proof. And again, we see that $x_2$ is computed in the same way as $y_2$ and therefore $x_2 = y_2$. Two down, two to go. By now, you probably know what's coming up for $x_3$ and $y_3$.

$$
\begin{aligned}
x_3 &= G_0(x_2, a_3) \\
y_3 &= G_0(y_2, b_3) \\
&= G_0(x_2, a_3) \\
&= x_3
\end{aligned}
$$

Again, we can use the fact that $x_2 = y_2$ to show that $x_3$ and $y_3$ are computed in the same fashion. Three down, one to go. You may have been wondering why I didn't follow the order of computation that I made very sure to get across earlier. That is because for all pairs of output bytes, it was enough to show that they are equal to one another. This time however, it won't suffice. We need to show that $x_0 \oplus y_0 = \texttt{0x02}$, so let's have a look.

$$
\begin{aligned}
\texttt{0x02}   &= x_0 \oplus y_0 \\
&= G_0(a_0, x_1) \oplus G_0(b_0, y_1) \\
&= G_0(a_0, x_1) \oplus G_0(a_0 \oplus \texttt{0x80}, x_1)
\end{aligned}
$$

As with the previous equations, we have substituted all bytes of $B$ with bytes of $A$ and we used the fact that $x_1 = y_1$. Nothing conveniently cancels out this time, so let's take a step back to remember what happens in the $G_0$ function. First, it takes the sum of its arguments and then takes it modulo 256. Finally, it performs a cyclic left shift by two places. Let's replace $G_0$ with its internal workings in the last line of the equation above.

$$
\texttt{0x02} = ((a_0 + c_1\kern-1em\,\pmod{256}) \lll 2) \oplus (((a_0 \oplus \texttt{0x80}) + c_1\kern-1em\,\pmod{256}) \lll 2)
$$

This is quite the opposite of the pretty equations where everything cancels out nicely. However, note that we're basically performing a cyclic left shift on two sums and then XORing them together. Even better: it doesn't matter if we first perform the cyclic left shift and then XOR or vice versa. We'll always be XORing the same bits with one another. This means that we can move the shift operation outside of the brackets and wrap them around the result of our XOR operation.

$$
\begin{aligned}
\texttt{0x02} &= ((a_0 + c_1\kern-1em\,\pmod{256})) \oplus ((a_0 \oplus \texttt{0x80}) + c_1\kern-1em\,\pmod{256})) \lll 2 \\
\texttt{0x02} \lll 6 = \texttt{0x80} &= (a_0 + c_1\kern-1em\,\pmod{256})) \oplus ((a_0 \oplus \texttt{0x80}) + c_1\kern-1em\,\pmod{256})
\end{aligned}
$$

This means we can apply the inverse of a cyclic left shift by two places to the other side of the equation. Intutively, this would be a cyclic right shift by two places. However, since we're working on bytes and a byte consists of eight bits, we can achieve the same by performing a cyclic left shift by six places (also there's no such thing as a triple angle bracket pointing to the right unfortunately).

More importantly, we finally see something familiar. We have a $\texttt{0x80}$ as part of an argument to the $G_0$ function and we have $\texttt{0x80}$ as the expected result. The only difference between both sides of the XOR operation is in $a_0$ on the left and $a_0 \oplus \texttt{0x80}$ on the right. The XOR would therefore yield $\texttt{0x80}$ as a result. This means we have successfully destructured $x_0 \oplus y_0 = \texttt{0x02}$ to a provably true statement and, furthermore, we've shown that all four pairs of output bytes yield the expected results given our specific input bytes.

### Homegrown cryptanalysis

Now that's great and all. However, when I started taking on the proof myself and finally getting where I wanted to be, the same old question roamed my mind that always comes up when some weird vaguely mathematical concept starts to click. How does someone come up with that? Would I have been able to figure it out myself? Keep in mind that FEAL-4 shows one of the earliest successful applications of differential cryptanalysis. This is an entire branch of cryptanalysis that was just being discovered and applied to ciphers as a whole.

{{< figure src="/images/feal-4/scribbles.jpg" alt="Sheet of paper with notes on FEAL-4 on it" caption="Some actual notes of mine pulling apart the FEAL-4 characteristic" >}}

So let's assume that I was alive during the dawn of differential cryptanalysis and that I, by stupid luck, knew that I could trace differences in a cipher as opposed to analyzing it linearly. I know that the security of any Feistel cipher is mostly concentrated within the construction of its round function, so I'd start looking at the round function and see how it behaves.

Please do note that things might get a little abstract from now on and if you wish to skip this section, then you're free to do so. This is just to provide another look at the FEAL-4 round function.

Again, let's call our round function inputs $A$ and $B$, the corresponding outputs $X$ and $Y$, and let's express every byte of $B$ in terms of $A$ using some differential $\Delta$. Earlier, we defined it to be $\texttt{0x80800000}$ but this time we say that it can be any value. We're trying to find out which properties our differential must show so that it becomes useful to us. Let's see how $\Delta$ impacts the computation, starting with the first output byte to be computed.

$$
\begin{aligned}
x_1 &= G_1(a_0 \oplus a_1, a_2 \oplus a_3) \\
y_1 &= G_1(a_0 \oplus \Delta_0 \oplus a_1 \oplus \Delta_1, a_2 \oplus \Delta_2 \oplus a_3 \oplus \Delta_3)
\end{aligned}
$$

We see that if $\Delta_0 = \Delta_1$ and $\Delta_2 = \Delta_3$, then our differential would cancel out. Furthermore, this would mean that $x_1$ and $y_1$ are computed the same way and, consequently, that the output difference for the second byte pair $x_1$ and $y_1$ would be zero. This is exactly what we used in our proof earlier, but this time we have it in a slightly more abstract shape. That's pretty convenient because by specifying a differential as opposed to two specific plaintexts, we're basically free to choose the latter as long as they satisfy the former &mdash; meaning we have lots of plaintext pairs to break our cipher with.

Cool, we already found a property that's being used in the actual differential cryptanalysis of FEAL-4. Let's see what else we can find.

$$
\begin{aligned}
x_0 &= G_0(a_0, x_1) \\
y_0 &= G_0(a_0 \oplus \Delta_0, y_1)
\end{aligned}
$$

Unless $\Delta_0$ is zero, there will be a difference between our first pair of output bytes $x_0$ and $y_0$ caused by our input differential. Also, due to the design of the cipher, any difference coming from the computation of the second output bytes will propagate here. We have already found a case where this difference will be zero.

Let's pretend that we define our input differential in a way which causes $x_1 = y_1$ for a minute. This means that in the computation of $x_0$ and $y_0$, the second argument to the $G_0$ function will be the same. Furthermore, this means that we'll see the difference caused by the first byte of our output differential $\Delta_0$ to show in the output difference of $x_0$ and $y_0$, namely in the shape of a cyclic left shift by two places.

Again, note that this is exactly what we used in the differential cryptanalysis of FEAL-4. Our characteristic is designed so that the second pair of output bytes will be equal to one another. Since the first byte of our input differential is not zero, namely $\texttt{0x80}$, we will see it in the first byte of the output difference as $\texttt{0x80} \lll 2$ which is $\texttt{0x02}$.

The remaining pairs of output bytes show, more or less, the same that we already established.

$$
\begin{aligned}
x_2 &= G_0(x_1, a_2 \oplus a_3) \\
y_2 &= G_0(y_1, a_2 \oplus \Delta_2 \oplus a_3 \oplus \Delta_3)
\end{aligned}
$$

Again, we see that if $\Delta_2 = \Delta_3$, then our input differential will cancel out in the computation of the third output byte. This is given if $x_1 = y_1$ since this is one of the conditions for it to work in the first place. But even if $x_1 \neq y_1$, we can at least force one of the two arguments in the equations above to be equal by letting $\Delta_2 = \Delta_3$. However, note that the differences in the computation of $x_1$ and $y_1$ will propagate here and, even worse, propagate to $x_3$ and $y_3$ as well.

$$
\begin{aligned}
x_3 &= G_1(x_2, a_3) \\
y_3 &= G_1(y_2, a_3 \oplus \Delta_3)
\end{aligned}
$$

Similar to the first output byte, we have another "unavoidable" output difference caused by the specification of our input differential. Unless $\Delta_3$ is zero, it will cause some difference in the last output byte. In the end, one thing should be obvious. The computation of $x_1$ and $y_1$ has consequences for all other output bytes which we can effectively suppress given what we found out at the beginning of this section. Otherwise, we get caught up in having to trace back the origin of certain differences which is what we want to prevent from happening. After all, we want to achieve more with less work.

This has been quite a lot, so let's summarize our findings.

* If $\Delta_0 = \Delta_1$ and $\Delta_2 = \Delta_3$, then the second pair of output bytes will be equal.
    * The third pair of output bytes will also be equal.
    * The second argument to the computation of the first pair of output bytes will also be equal.
* The computation of $x_1$ and $y_1$ and their difference will inevitably affect all other output bytes unless the input differential is constructed as stated in the previous point.
* If the second pair of output bytes is equal to one another, and $\Delta_0 \neq \texttt{0x00}$, then it'll appear in the difference of the first output bytes as a cyclic left shift by two places of itself.
    * The same applies to the last byte of the input differential and the difference of the last output bytes respectively.

Using all these insights to craft a distinct input differential would make this article drag on forever. This should suffice to know how one might approach the process of finding an interesting characteristic.

### Conclusion

FEAL-4 is a dead horse. It has been thoroughly analyzed and broken beyond the point of recovery. Yet, in my opinion, it is one of the easiest examples to understand in the field of differential cryptanalysis. I only touched on one aspect of the entire FEAL-4 differential cryptanalysis and it turned into a behemoth of an article. I sunk more hours into this subject than I'd like to admit. But if something gets me going, then it's watching seemingly complex systems collapse under their own weight due to some simple and beautiful oversights in their design.

During my research, I also wrote some code to test different inputs against the FEAL-4 round function. The code is written in C++ and available to look at in a [Github gist](https://gist.github.com/JoogsWasTaken/3dbb5254ddb51a5ec6372c65cd700ab2). Feel free to copy it, modify it and play with it however you please. By default, the code asks for two 32 bit hexadecimal inputs, runs them both through the round function and prints the results as well as the input and output differences. Don't bash me too hard for the jank in some parts &mdash; I'm still learning.

```text
joogs@owlspace:~/feal4-cpp$ g++ feal4.cpp -o feal4
joogs@owlspace:~/feal4-cpp$ ./feal4
Input A: 80818283
Input B: 00018283

          A = 80818283
          B = 80818283
      A ^ B = 80800000

       F(A) = 320C34E2
       F(B) = 300C34E2
F(A) ^ F(B) = 02000000
```

### Resources

* [Applied Cryptanalysis &mdash; Breaking Ciphers In The Real World](https://onlinelibrary.wiley.com/doi/book/10.1002/9780470148778). Mark Stamp and Richard M. Low. (Chapter 4.7. Published: 2007. ISBN: 978-0-470-11486-5. DOI: 10.1002/9780470148778.)
* [Differential Cryptanalysis of FEAL](http://theamazingking.com/crypto-feal.php). Jon King. (Last updated: May 13th, 2013.)
* [The cryptanalysis of FEAL-4 with twenty chosen plaintexts](https://www.isg.rhul.ac.uk/~sean/feal.pdf). Sean Murphy.