pnpm dev

setup 设置 Git 用户配置
```
git config user.email "knxjulien@gmail.com"
git config user.name "knxjulien"
```
这是为了设置提交时用于个人识别的Git配置信息



查看本地分支，这个命令列出了所有本地的分支，并且显示当前您处于 main 分支。
```
git branch
* main
```

查看远程仓库地址 这个命令显示了远程仓库（通常被称为 "origin"）的URL
```
git remote -v
origin  https://github.com/JulienZJJ/hear.git (fetch)
origin  https://github.com/JulienZJJ/hear.git (push)
```

添加上游仓库（upstream）并查看，这是在您的本地git配置中添加另一个远程仓库的引用，通常用于跟踪主仓库（原仓库）的更新。
```
julienz@ZJJdeMacBook-Pro hear % git remote add upstream https://github.com/lwtlab/hear.git
julienz@ZJJdeMacBook-Pro hear % git remote -v
origin  https://github.com/JulienZJJ/hear.git (fetch)
origin  https://github.com/JulienZJJ/hear.git (push)
upstream        https://github.com/lwtlab/hear.git (fetch)
upstream        https://github.com/lwtlab/hear.git (push)
```

拉取 upstream 所有分支的代码 通过这个命令，您可以从上游仓库拉取所有新的或更新的分支和数据。
```
git fetch upstream
```

合并最核心的那个仓库（upstream）的代码到您的本地分支 运行这个命令会将上游仓库的更新合并到您当前的本地分支（这里是 main）。

```
git merge upstream/main
```


```
git status
On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean
```


在push前设置代理（如果需要的话）  这些命令设置了用于git操作的代理服务器，这在您需要通过特定的网络代理连接到互联网时很有用
export https_proxy=http://127.0.0.1:23457;export http_proxy=http://127.0.0.1:23457;export all_proxy=socks5://127.0.0.1:23456


推送代码到origin仓库的main分支  完成所有合并后，这个命令会将您本地分支上的更改推送到远程origin仓库的main分支。
git push origin main
```