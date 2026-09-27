# Triolla: Take-home assignment

> The assignment as received (from the PDF). Summer's email is the whole spec.

Hi, and thanks for taking the time to do this.

You'll get a message from a client, and we'd like you to build what you think it needs. There is no starter repo and no list of requirements. Everything you need to know is in this document.

## The situation

We tried to make this feel like a normal week at Triolla. You've just joined us as a developer. Summer Smith runs operations at Squanchy Bakery, a chain of twelve branches, and she sent us the email below.

Summer isn't technical. A large part of the job here is turning what a client asks for into working software, so the email is the whole spec.

Summer is about to leave for two weeks and can't be reached before she goes, so there are no follow-up questions. Where the email leaves something open, make the call you think is right and write it down. Any reasonable call is fine as long as we can see it. There is no single right answer we're checking against.

## The email

**Subject:** fridge temperature files, can you help?

Hi,

We have twelve branches, and every branch has a few fridges with a small temperature logger clipped inside. Once a week each branch manager downloads the logger's file and emails it to me. I paste everything into one Excel sheet and go looking for problems. It takes me most of Sunday and I still miss things.

The Ministry of Health inspector asks me "when did this fridge go above five degrees, and for how long?" and honestly, today I can't answer that. Last month we threw out a full fridge of dairy in Rishon because nobody noticed it had been slowly dying for two days.

A few things that make it messy, so you know what you're getting into. The old logger in Haifa shows the numbers differently from all the others, so I convert in my head. We moved one of the Tel Aviv loggers into the new display fridge last week. The files don't look quite the same from branch to branch, the columns move around. Sometimes there's a gap of a couple of hours in a file and I never know if the logger died, the battery ran out, or it just didn't save. And someone opens the door for a delivery and you see a jump for one reading, which is fine. A fridge that's slowly warming up is not fine.

What I want is to upload the files and see, in one place, how every fridge is doing and where something is wrong. And to be able to answer the inspector. I'm between branches most of the day, so I mostly look at things on my phone.

Here are some rows from this week's sheet so you can see what it looks like. The real one is about three thousand rows. The logger files themselves only have the time and the temperature, I type in the logger number, the branch and the fridge myself when I paste.

| Logger | Branch | Fridge | Time | Temp |
|---|---|---|---|---|
| TL-0512 | Jerusalem | Dairy | 2026-09-14 06:00 | 3.8 |
| TL-0417 | Tel Aviv | Walk-in | 2026-09-14 06:00 | 4.1 |
| TL-0231 | Haifa | Dairy | 14/09/2026 06:00 | 38.3 |
| TL-0512 | Jerusalem | Dairy | 2026-09-14 06:15 | 3.9 |
| TL-0417 | Tel Aviv | Walk-in | 2026-09-14 06:15 | 9.4 |
| TL-0388 | Rishon LeZion | Cream cakes | 2026-09-14 06:00 | 4.6 |
| TL-0417 | Tel Aviv | Walk-in | 2026-09-14 06:30 | 4.3 |
| TL-0231 | Haifa | Dairy | 14/09/2026 06:15 | 39.0 |
| TL-0512 | Jerusalem | Dairy | 2026-09-14 06:15 | 3.9 |
| TL-0388 | Rishon LeZion | Cream cakes | 2026-09-14 06:15 | 5.4 |
| TL-0417 | Tel Aviv | Walk-in | 2026-09-14 05:45 | 4.0 |
| TL-0388 | Rishon LeZion | Cream cakes | 2026-09-14 06:30 | 6.3 |
| TL-0231 | Haifa | Dairy | 14/09/2026 06:30 | ERR |
| TL-0388 | Rishon LeZion | Cream cakes | 2026-09-14 06:45 | 7.1 |
| TL-0512 | Jerusalem | Dairy | 2026-09-14 08:30 | 4.0 |
| TL-0417 | tel aviv | Display 2 | 2026-09-17 06:00 | 3.7 |

Let me know what you need from me. I'm off for two weeks from Sunday, so don't wait on me. Thanks!!

Summer

## What to build

Whatever you think Summer needs. Any language, any framework, any architecture. There's exactly one constraint: we should be able to run it on a laptop by following your README, with no accounts and no paid services. No need to deploy it anywhere.

The sample table is all the data there is. Make up more if you need it, in whatever shape you think the loggers' files would have.

## Time

Please send it within 48 hours of getting this email. If you need more time, just tell us. That's fine, and it doesn't count against you.

If you run out of time, submit what you have and write down what's left. A partial submission with a clear explanation is a good submission. We'd rather see a few decisions made well and explained than a lot of features half done.

## AI tools

AI tools are expected. Use whatever you normally work with. We don't grade how much you typed by hand. We'll ask about your choices in the follow-up conversation, so it's worth submitting work you can talk through.

## What to submit

Reply to the email you got this from with a link to a public GitHub repository. Please double-check it's public, or we can't open it. The repository should contain:

- A README.md that gets us from clone to running in a few minutes.
- A short NOTES.md. Bullets are fine. Please cover:
  - Roughly how long you spent. Not graded. It just helps us know what to expect.
  - Decisions you made that Summer didn't ask for, and why.
  - What you'd want to ask Summer before this goes live.
  - What's not done, and what you'd do with one more hour.
  - How you worked with your AI tools: one thing they got wrong or you rejected, how you caught it, and where in the repo we can see it (a commit, a test, a note).
  - Anything else about how you approached this. Optional.

Submit the repository as you actually worked in it, without cleaning it up for us. Messy is fine. Whatever you set up to work effectively belongs in the repo too: planning notes, specs, instructions for your tools, anything you'd hand a teammate joining you tomorrow. How you got there interests us as much as where you ended up.

If anything about the assignment itself is unclear, reply to the same email before you start. We'd much rather you ask than guess.

We hope you enjoy it. Good luck.
