### Promotional Copy

**English** | [中文](./README.md)

🚀 **Say Goodbye to Version Selection Anxiety! I Built a Tool to Help You Find the "Golden Version" of Any NPM Package**

As a front-end developer, I often find myself in a dilemma.

When developing a universal library (e.g., one that supports Vue, React, and SolidJS), I need to set a **minimum compatible version** for these peer dependencies in `package.json`.

I can't just use the `latest` version because that would exclude many projects still using older versions, significantly reducing my library's reach. But if the version is too old, I miss out on the performance advantages and new features of newer versions.

`npm.com` just coldly lists all the versions but doesn't tell me which one is the **mainstream choice** in the community.

**My strategy is to find a "golden version": a version where the total downloads of it and all newer versions account for 90% of the total downloads in the past 7 days.**

To achieve this, I developed **NPM Version Stat**!

This little tool has one core function:
1.  Enter any NPM package name.
2.  It fetches the weekly download data for all versions.
3.  **It sorts them by download count in descending order**, letting you see at a glance which version is the most popular.
4.  It automatically highlights the "**golden version**" that meets the 90% download threshold!

Now, whether I'm choosing dependencies for my own library or deciding if a project should upgrade, I have data to back my decisions, making the process simpler and more confident than ever before.

If you've ever struggled with version selection, give this tool a try.

🔗 **Try it online**: [https://npm-version-stat.vercel.app/](https://npm-version-stat.vercel.app/)
🛠️ **GitHub Repository**: [https://github.com/siaikin/npm-version-stat](https://github.com/siaikin/npm-version-stat)
