pnpm dev

本地分支
```
git branch
* main
```

远程仓库
```
git remote -v
origin  https://github.com/JulienZJJ/hear.git (fetch)
origin  https://github.com/JulienZJJ/hear.git (push)
```

```
julienz@ZJJdeMacBook-Pro hear % git remote add upstream https://github.com/lwtlab/hear.git
julienz@ZJJdeMacBook-Pro hear % git remote -v
origin  https://github.com/JulienZJJ/hear.git (fetch)
origin  https://github.com/JulienZJJ/hear.git (push)
upstream        https://github.com/lwtlab/hear.git (fetch)
upstream        https://github.com/lwtlab/hear.git (push)
```

拉取 upstream 所有分支的代码
```
git fetch upstream
```

合并最核心的那个仓库的代码

```
git merge upstream/main
```

```
git status
On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean
```