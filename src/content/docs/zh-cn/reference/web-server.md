---
title: Web Server
description: AI Hear as web server
sidebar:
  hidden: true
---

AI Hear 还提供了将转录数据发送给其他客户端的能力，帮助其他客户端快速低成本的实现实时语音转写、翻译等功能。

## 一、准备工作

- 安装支持 Web Server 的 AI Hear 版本
- 打开应用并启动 Web Server

  > 💡 某些定制版本的 AI Hear 可能会在应用启动的时候默认打开

  ![](../../../../assets/images/webserver/WX20250413-000235@2x.png)

## 二、快速开始

```bash
# 1、订阅 Server-Sent Events
curl -v -N -H "Accept: text/event-stream" http://localhost:35123/events

# 2、开始转录
curl "http://localhost:35123/start?source=system&model=tiny&lang_from=en&lang_to=zh-Hans"

# 3、停止转录
curl "http://localhost:35123/stop"

# 4、获取模型列表[可选]
curl "http://localhost:35123/models"

# 5、获取全量字幕[可选]
curl "http://localhost:35123/allcaptions"

# 6、下载模型[可选]
curl "http://localhost:35123/download?model=base"

# 7、获取/设置 当前配置[可选]
# 获取 get
curl "http://localhost:35123/config?key=STORE_USE_MODEL"
# 设置 set
curl "http://localhost:35123/config?key=STORE_USE_MODEL&value=tiny"

# 8、获取某个时间段的音频样本[可选]
curl "http://localhost:35123/samples?start=0.000&end=0.500"
```

## 三、接口

### 1、/events - 订阅 Server-Sent Events

| 事件      | 描述     | 备注 |
| --------- | -------- | ---- |
| captions  | 转录字幕 |      |
| translate | 字幕翻译 |      |
| download  | 模型下载 |  下载信息回传，详细见 [/download](#6download---下载模型) 接口 |
| samples   | 音频样本 |  采样率 48000   |
| ping      | 心跳    |      |
| open      | 连接建立 |      |
| close     | 连接关闭 |      |
| error     | 错误信息 |      |

### 2、/start - 开始转录

- method `GET` `POST`

- request

| 参数名    | 类型   | 描述     | 是否必须 | 默认值 | 备注                                                                               |
| --------- | ------ | -------- | -------- | ------ | ---------------------------------------------------------------------------------- |
| source    | string | 音频源   | 否       | system | system 或 microphone                                                               |
| model     | string | 语音模型 | 否       | tiny   | 可以是[内置模型](#2内置模型列表)或者外部模型：内置模型传模型名，外部模型传绝对地址 |
| lang_from | string | 音频语言 | 否       | auto   | [语言代码](#3语言列表)，例如：zh-Hans、en                                          |
| lang_to   | string | 翻译语言 | 否       | n/a    | [语言代码](#3语言列表)，例如：zh-Hans、en                                          |

- response

| 参数名  | 类型   | 描述     |
| ------- | ------ | -------- |
| code    | int    | 状态码   |
| message | string | 描述信息 |
| data    | object | 数据     |

### 3、/stop - 停止转录

- method `GET` `POST`

- request

| 参数名 | 类型 | 描述 | 是否必须 | 默认值 | 备注 |
| ------ | ---- | ---- | -------- | ------ | ---- |

- response

| 参数名  | 类型   | 描述     |
| ------- | ------ | -------- |
| code    | int    | 状态码   |
| message | string | 描述信息 |
| data    | object | 数据     |

### 4、/models - 获取模型列表

- method `GET` `POST`

- request

| 参数名 | 类型 | 描述 | 是否必须 | 默认值 | 备注 |
| ------ | ---- | ---- | -------- | ------ | ---- |

- response

| 参数名  | 类型   | 描述     |
| ------- | ------ | -------- |
| code    | int    | 状态码   |
| message | string | 描述信息 |
| data    | object | 模型数组 |

```json
{
  "code": 200,
  "message": "get models success",
  "data": [
    {
      "model": "tiny",
      "tag": ["realtime", "tiny"],
      "repo": "ggerganov/whisper.cpp",
      "repoFile": "ggml-tiny.bin",
      "desc": "Very fast but bad accuracy",
      "disk": "75 MB",
      "size": 77691713,
      "mem": "~390 MB",
      "sha": "bd577a113a864445d4c299885e0cb97d4ba92b5f",
      "localPath": "/Users/xxxx/Library/Application Support/AIHear/models/ggml-tiny.bin"
    },
    {
      "lang": ["en"],
      "model": "tiny.en",
      "tag": ["realtime", "tiny"],
      "repo": "ggerganov/whisper.cpp",
      "repoFile": "ggml-tiny.en.bin",
      "desc": "Very fast but bad accuracy. English only.",
      "disk": "75 MB",
      "size": 77704715,
      "mem": "~390 MB",
      "sha": "c78c86eb1a8faa21b369bcd33207cc90d64ae9df",
      "localPath": "/Users/xxxx/Library/Application Support/AIHear/models/ggml-tiny.en.bin"
    },
    {
      "model": "base",
      "tag": ["realtime", "base"],
      "repo": "ggerganov/whisper.cpp",
      "repoFile": "ggml-base.bin",
      "desc": "Fast with decent accuracy",
      "disk": "142 MB",
      "size": 147951465,
      "mem": "~500 MB",
      "sha": "465707469ff3a37a2b9b8d8f89f2f99de7299dac",
      "localPath": ""
    },
    {
      "lang": ["en"],
      "model": "base.en",
      "tag": ["realtime", "base"],
      "repo": "ggerganov/whisper.cpp",
      "repoFile": "ggml-base.en.bin",
      "desc": "Fast with decent accuracy. English only.",
      "disk": "142 MB",
      "size": 147964211,
      "mem": "~500 MB",
      "sha": "137c40403d78fd54d454da0f9bd998f78703390c",
      "localPath": ""
    },
    {
      "lang": ["zh", "en", "yue", "ja", "ko"],
      "model": "sensevoice.small",
      "tag": ["realtime", "sensevoice", "quantized"],
      "repo": "xumo/sense-voice-gguf",
      "repoFile": "gguf-fp16-sense-voice-small.bin",
      "desc": "Experimental. SenseVoice Small is an open-source speech recognition model developed by Alibaba, supporting multiple languages including Chinese, English, Cantonese, Japanese, and Korean.",
      "disk": "466 MB",
      "size": 469406560,
      "mem": "~1.0 GB",
      "sha": "8176595ec830f32f385ca6d28ad86008db88de32",
      "localPath": "/Users/xxxx/Library/Application Support/AIHear/models/gguf-fp16-sense-voice-small.bin"
    },
    {
      "model": "small",
      "tag": ["realtime", "small"],
      "repo": "ggerganov/whisper.cpp",
      "repoFile": "ggml-small.bin",
      "desc": "Normal speed with good accuracy",
      "disk": "466 MB",
      "size": 487601967,
      "mem": "~1.0 GB",
      "sha": "55356645c2b361a969dfd0ef2c5a50d530afd8d5",
      "localPath": ""
    },
    {
      "lang": ["en"],
      "model": "small.en",
      "tag": ["realtime", "small"],
      "repo": "ggerganov/whisper.cpp",
      "repoFile": "ggml-small.en.bin",
      "desc": "Normal speed with good accuracy. English only.",
      "disk": "466 MB",
      "size": 487614201,
      "mem": "~1.0 GB",
      "sha": "db8a495a91d927739e50b3fc1cc4c6b8f6c2d022",
      "localPath": ""
    },
    {
      "model": "medium",
      "tag": ["medium"],
      "repo": "ggerganov/whisper.cpp",
      "repoFile": "ggml-medium.bin",
      "desc": "Warning: Only suitable for file transcription (coming soon). Slow but great accuracy",
      "disk": "1.5 GB",
      "size": 1533763059,
      "mem": "~2.6 GB",
      "sha": "fd9727b6e1217c2f614f9b698455c4ffd82463b4",
      "localPath": ""
    },
    {
      "model": "ggml-medium-q5_0",
      "tag": ["medium", "quantized"],
      "repo": "ggerganov/whisper.cpp",
      "repoFile": "ggml-medium-q5_0.bin",
      "desc": "Slow but great accuracy",
      "disk": "539 MB",
      "size": 539212467,
      "mem": "~1.0 GB",
      "sha": "7718d4c1ec62ca96998f058114db98236937490e",
      "localPath": ""
    },
    {
      "lang": ["en"],
      "model": "medium.en",
      "tag": ["medium"],
      "repo": "ggerganov/whisper.cpp",
      "repoFile": "ggml-medium.en.bin",
      "desc": "Warning: Only suitable for file transcription (coming soon). Slow but great accuracy",
      "disk": "1.5 GB",
      "size": 1533774781,
      "mem": "~2.6 GB",
      "sha": "8c30f0e44ce9560643ebd10bbe50cd20eafd3723",
      "localPath": ""
    },
    {
      "model": "large-v3-turbo-q5_0",
      "tag": ["realtime", "large"],
      "repo": "ggerganov/whisper.cpp",
      "repoFile": "ggml-large-v3-turbo-q5_0.bin",
      "desc": "Whisper large-v3-turbo is a finetuned version of a pruned Whisper large-v3.",
      "disk": "574 MB",
      "size": 574041195,
      "mem": "~?? GB",
      "sha": "e050f7970618a659205450ad97eb95a18d69c9ee",
      "localPath": ""
    },
    {
      "model": "large-v2",
      "tag": ["large"],
      "repo": "ggerganov/whisper.cpp",
      "repoFile": "ggml-large-v2.bin",
      "desc": "Warning: Only suitable for file transcription (coming soon). Most accurate transcription, updated model but can have repetition in transcript",
      "disk": "2.9 GB",
      "size": 3094623691,
      "mem": "~4.7 GB",
      "sha": "0f4c8e34f21cf1a914c59d8b3ce882345ad349d6",
      "localPath": ""
    },
    {
      "model": "large-v3",
      "tag": ["large"],
      "repo": "ggerganov/whisper.cpp",
      "repoFile": "ggml-large-v3.bin",
      "desc": "Warning: Only suitable for file transcription (coming soon). Most accurate transcription, updated model but can have repetition in transcript",
      "disk": "2.9 GB",
      "size": 3095033483,
      "mem": "~4.7 GB",
      "sha": "ad82bf6a9043ceed055076d0fd39f5f186ff8062",
      "localPath": ""
    },
    {
      "model": "ggml-large-v2-q5_0",
      "tag": ["large", "quantized"],
      "repo": "ggerganov/whisper.cpp",
      "repoFile": "ggml-large-v2-q5_0.bin",
      "desc": "Most accurate transcription, updated model but can have repetition in transcript",
      "disk": "1.1 GB",
      "size": 1080732091,
      "mem": "2 GB",
      "sha": "00e39f2196344e901b3a2bd5814807a769bd1630",
      "localPath": ""
    }
  ]
}
```

### 5、/allcaptions - 获取全量字幕

> ⚠️ 最好不要轮询这个接口作为实时字幕，因为这个接口会返回所有的字幕，可能会导致内存占用过高，建议使用 [/events](#1events---订阅-server-sent-events) 接口作为实时字幕。

- method `GET` `POST`

- request

| 参数名 | 类型 | 描述 | 是否必须 | 默认值 | 备注 |
| ------ | ---- | ---- | -------- | ------ | ---- |

- response

| 参数名  | 类型   | 描述     |
| ------- | ------ | -------- |
| code    | int    | 状态码   |
| message | string | 描述信息 |
| data    | object | 字幕数组 |

```json
{
  "code": 200,
  "message": "get all captions success",
  "data": [
    {
      "startTime": 0,
      "endTime": 6.32,
      "text": " Yeah, good morning from the largest Roman Catholic Church in England and Wales.",
      "subSegments": [
        {
          "index": 0,
          "startTime": 0,
          "endTime": 6.32,
          "text": " Yeah, good morning from the largest Roman Catholic Church in England and Wales."
        }
      ],
      "fixed": true,
      "translateText": "是的，来自英格兰和威尔士最大的罗马天主教堂的早上好。"
    },
    {
      "startTime": 6.320000171661377,
      "endTime": 11.600000171661378,
      "text": " it was here really that's been the focal point for the past 24 hours for Catholics in this",
      "subSegments": [
        {
          "index": 1,
          "startTime": 6.320000171661377,
          "endTime": 11.600000171661378,
          "text": " it was here really that's been the focal point for the past 24 hours for Catholics in this"
        }
      ],
      "fixed": true,
      "translateText": "在过去的 24 小时内，这里确实是天主教徒的焦点"
    },
    {
      "startTime": 11.600000381469727,
      "endTime": 16.560000381469727,
      "text": " part of the world to come and pay their respects to Pope Francis. And it was",
      "subSegments": [
        {
          "index": 2,
          "startTime": 11.600000381469727,
          "endTime": 16.560000381469727,
          "text": " part of the world to come and pay their respects to Pope Francis. And it was"
        }
      ],
      "fixed": true,
      "translateText": "世界上的一部分人来向教皇弗朗西斯表示敬意。事实确实如此"
    },
    {
      "startTime": 16.559999465942383,
      "endTime": 22.079999465942382,
      "text": " inside the cathedral yesterday evening where there was a large wreck we have.",
      "subSegments": [
        {
          "index": 3,
          "startTime": 16.559999465942383,
          "endTime": 22.079999465942382,
          "text": " inside the cathedral yesterday evening where there was a large wreck we have."
        }
      ],
      "fixed": false
    }
  ]
}
```

### 6、/download - 下载模型

- method `GET` `POST`

- request
  | 参数名 | 类型 | 描述 | 是否必须 | 默认值 | 备注 |
  | ------ | ---- | ---- | -------- | ------ | ---- |
  | model | string | 模型名 | 是 |  | 模型名 |

- response
  | 参数名 | 类型 | 描述 |
  | ------- | ------ | -------- |
  | code | int | 状态码 |
  | message | string | 描述信息 |
  | data | object | 数据 |

```json
{
  "code": 200,
  "message": "downloader start success",
  "data": {
    "model": "base"
  }
}
```

> 💡 下载进度和结果信息通过 SSE `download` 事件回传

```json
event: download
data: {"status":"started","model":"base"}

event: download
data: {"status":"downloading","model":"base","progress":0.12510545941535625}

event: download
data: {"status":"downloading","model":"base","progress":0.9999140055828444}

event: download
data: {"status":"downloading","model":"base","progress":1}

event: download
data: {"status":"completed","model":"base"}
```

| status | 描述 | 备注 |
| ------ | -------- |----|
| started | 下载开始 | |
| downloading | 下载中 | progress [0-1] 表示进度信息 |
| completed | 下载成功 | |
| failed | 下载失败 | |


### 7、/config - 获取/设置 当前配置

- method `GET` `POST`

- request

| 参数名 | 类型 | 描述 | 是否必须 | 默认值 | 备注 |
| ------ | ---- | ---- | -------- | ------ | ---- |
| key | string | 配置键 | 是 |  | 配置键 |
| value | string | 配置值 | 否 |  | 配置值。当 value 存在时，为设置值 |

- response

| 参数名  | 类型   | 描述     |
| ------- | ------ | -------- |
| code    | int    | 状态码   |
| message | string | 描述信息 |
| data    | object | 数据     |

- 允许配置的 key 值

| 键名 | 类型 | 描述 | 举例 | 备注 |
| ---- | ---- | ---- | ------ | ---- |
| STORE_USE_MODEL | string | 使用的模型 | 如：tiny | 模型名，请严格按照模型列表中已经下载的 model 设置 |
| STORE_GPU_ID | string | 选在使用的 GPU | 如："0" |  |
| STORE_VAD_ENABLED | boolean | 开启 VAD | 如：true |  |
| STORE_CAPTION_VISABLE | boolean | 是否显示字幕 | 如：true |  |
| STORE_TRANSLATOR_ENGINE_V1 | array | 翻译引擎配置 |  | 详细介绍如下 |
| STORE_PROVIDERS | array | LLM 提供者配置 |  | 详细介绍如下 |

> 注意⚠️：下面对`翻译引擎配置 - STORE_TRANSLATOR_ENGINE_V1`做个详细的介绍，需要严格按照下面的格式配置。

```json
//1、比如下面 5 个翻译引擎，按照排列顺序，其中第一个是默认的翻译引擎，如果第一个翻译引擎失败，会尝试第二个翻译引擎，以此类推。
//2、每个翻译都有 code 和 name。code 是翻译引擎的唯一标识，name 是翻译引擎在界面上展示的名称。
//3、microsoft、bing 和 google 这三个翻译引擎是内置的，会联网请求对应的厂商。【最好不要删掉】
//4、openai 是调用 LLM 进行翻译。无论是 Ollama、DeepSeek 还是 MoonShot，都是支持 openai 协议的。所以 code 都是 openai
//5、openai 翻译引擎需要配置 model 和 prompt。model 是 LLM 的模型名称，prompt 是翻译的提示词。
//6、prompt 支持的变量有：{{to}} 和 {{content}}。to 是翻译的目标语言，content 是翻译的内容。
[
  {
    "code": "openai",
    "name": "Ollama",
    "model": "qwen2:1.5b",
    "prompt": "Translate the following text into {{to}} and only show me the translated content:\n{{content}}"
  },
  {
    "code": "microsoft",
    "name": "Microsoft Translator"
  },
  {
    "code": "bing",
    "name": "Bing Translator"
  },
  {
    "code": "google",
    "name": "Google Translate"
  },
  {
    "code": "openai",
    "name": "MoonShot",
    "model": "moonshot-v1-8k",
    "prompt": "Translate the following text into {{to}} and only show me the translated content:\n{{content}}"
  }
]
```
> 🔔 GET 方法不方便传参可以使用 POST
```bash
curl -X POST "http://localhost:35123/config" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "key=STORE_TRANSLATOR_ENGINE_V1" \
  -d 'value=[
      {
        "code": "openai",
        "name": "Ollama",
        "model": "qwen2:1.5b",
        "prompt": "Translate the following text into {{to}} and only show me the translated content:\n{{content}}"
      },
      {
        "code": "microsoft",
        "name": "Microsoft Translator"
      },
      {
        "code": "bing",
        "name": "Bing Translator"
      },
      {
        "code": "google",
        "name": "Google Translate"
      }
    ]'
```

> 注意⚠️：下面对`LLM 提供者配置 - STORE_PROVIDERS`做个详细的介绍，需要严格按照下面的格式配置。

```json
[
  {
    "brand": "Ollama",
    "descriptions": "Ollama is a versatile, open-source tool that enables users to run and interact with large language models (LLMs) directly on their local machines. It is recommended to use smaller models such as qwen2:1.5b for real-time translation. https://www.ollama.com/",
    "domain": "http://127.0.0.1:11434",
    "path": "/v1/chat/completions",
    "key": "ollama", // Ollama 的这个 key 是固定的，不要修改
    "models": [
      "qwen2:1.5b",
      "qwen2:2.5b"
    ]
  },
  {
    "brand": "DeepSeek",
    "descriptions": "DeepSeek is a cutting-edge AI company that has developed a series of high-performance language models under the DeepSeek LLM brand. Their API pricing is quite affordable. https://www.deepseek.com/",
    "domain": "https://api.deepseek.com",
    "path": "/v1/chat/completions",
    "key": "sk-1234567890",
    "models": [
      "deepseek-chat"
    ]
  },
  {
    "brand": "MoonShot",
    "descriptions": "Moonshot AI is a prominent Chinese startup that specializes in the development of advanced artificial intelligence technologies, particularly large language models (LLMs) and conversational AI solutions. Please note, the free quota is subject to throttling which may affect the real-time translation experience. https://www.moonshot.cn/",
    "domain": "https://api.moonshot.cn",
    "path": "/v1/chat/completions",
    "key": "sk-1234567890",
    "models": [
      "moonshot-v1-8k"
    ]
  }
]
```
> 🔔 GET 方法不方便传参可以使用 POST
```bash
curl -X POST "http://localhost:35123/config" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "key=STORE_PROVIDERS" \
  -d 'value=[
  {
    "brand": "Ollama",
    "descriptions": "Ollama is a versatile, open-source tool that enables users to run and interact with large language models (LLMs) directly on their local machines. It is recommended to use smaller models such as qwen2:1.5b for real-time translation. https://www.ollama.com/",
    "domain": "http://192.168.3.11:11434",
    "path": "/v1/chat/completions",
    "key": "ollama",
    "models": [
      "qwen2:1.5b",
      "qwen2:2.5b"
    ]
  },
  {
    "brand": "DeepSeek",
    "descriptions": "DeepSeek is a cutting-edge AI company that has developed a series of high-performance language models under the DeepSeek LLM brand. Their API pricing is quite affordable. https://www.deepseek.com/",
    "domain": "https://api.deepseek.com",
    "path": "/v1/chat/completions",
    "key": "sk-1234567890",
    "models": [
      "deepseek-chat"
    ]
  },
  {
    "brand": "MoonShot",
    "descriptions": "Moonshot AI is a prominent Chinese startup that specializes in the development of advanced artificial intelligence technologies, particularly large language models (LLMs) and conversational AI solutions. Please note, the free quota is subject to throttling which may affect the real-time translation experience. https://www.moonshot.cn/",
    "domain": "https://api.moonshot.cn",
    "path": "/v1/chat/completions",
    "key": "sk-1234567890",
    "models": [
      "moonshot-v1-8k"
    ]
  }
]'
```

- 全量测试用例

```bash

# STORE_USE_MODEL
curl "http://localhost:35123/config?key=STORE_USE_MODEL"
curl "http://localhost:35123/config?key=STORE_USE_MODEL&value=tiny"

# STORE_GPU_ID
curl "http://localhost:35123/config?key=STORE_GPU_ID"
curl "http://localhost:35123/config?key=STORE_GPU_ID&value=0"

# STORE_VAD_ENABLED
curl "http://localhost:35123/config?key=STORE_VAD_ENABLED"
curl "http://localhost:35123/config?key=STORE_VAD_ENABLED&value=true"

# STORE_CAPTION_VISABLE
curl "http://localhost:35123/config?key=STORE_CAPTION_VISABLE"
curl "http://localhost:35123/config?key=STORE_CAPTION_VISABLE&value=true"

# STORE_TRANSLATOR_ENGINE_V1
curl "http://localhost:35123/config?key=STORE_TRANSLATOR_ENGINE_V1" 

# STORE_PROVIDERS
curl "http://localhost:35123/config?key=STORE_PROVIDERS"
```

### 8、/samples - 获取音频数据

> 获取某个时间段的音频数据。采样率固定为 48kHZ。

- method `GET` `POST`

- request

| 参数名 | 类型 | 描述 | 是否必须 | 默认值 | 备注 |
| ------ | ---- | ---- | -------- | ------ | ---- |
| start | number | 开始时间 | 是 |  | 开始时间：0.000 |
| end | number | 结束时间 | 是 |  | 结束时间: 0.500 |

- response

| 参数名  | 类型   | 描述     |
| ------- | ------ | -------- |
| code    | int    | 状态码   |
| message | string | 描述信息 |
| data    | array | 音频数据     |


```json
{
  "code": 200,
  "message": "get samples success",
  "data": [
    0,
    0,
    ...
    -0.000056416422012262046,
    -0.000010201700206380337,
    0.00002678551390999928,
    0.00019265383889432997,
    0.0004740342847071588,
    0.0007094581960700452,
    0.0006482700118795037,
    -0.000025427318178117275,
    -0.0011815381003543735,
    -0.001975413877516985,
    ...
    0.04307695850729942,
    0.04568144306540489
  ]
}
```

> 如果需要将音频数据保存到文件，可以使用下面的参考代码

```js
const fs = require('fs');
const axios = require('axios'); // 需要安装 axios: npm install axios

// WAV 文件参数
const SAMPLE_RATE = 48000;
const BITS_PER_SAMPLE = 16;
const NUM_CHANNELS = 1;

async function fetchAudioData(start, end) {
    try {
        const url = `http://localhost:35123/samples?start=${start}&end=${end}`;
        const response = await axios.get(url);
        return response.data.data;
    } catch (error) {
        console.error('Error fetching audio data:', error);
        throw error;
    }
}

function createWavHeader(dataLength) {
    const byteRate = SAMPLE_RATE * NUM_CHANNELS * BITS_PER_SAMPLE / 8;
    const blockAlign = NUM_CHANNELS * BITS_PER_SAMPLE / 8;
    const subChunk2Size = dataLength * NUM_CHANNELS * BITS_PER_SAMPLE / 8;
    const chunkSize = 36 + subChunk2Size;
    
    const buffer = Buffer.alloc(44);
    
    // RIFF header
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(chunkSize, 4);
    buffer.write('WAVE', 8);
    
    // fmt subchunk
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
    buffer.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
    buffer.writeUInt16LE(NUM_CHANNELS, 22);
    buffer.writeUInt32LE(SAMPLE_RATE, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(BITS_PER_SAMPLE, 34);
    
    // data subchunk
    buffer.write('data', 36);
    buffer.writeUInt32LE(subChunk2Size, 40);
    
    return buffer;
}

function floatToInt16(floatValue) {
    // 将 -1.0 到 1.0 的浮点数转换为 16 位有符号整数
    return Math.max(-32768, Math.min(32767, Math.round(floatValue * 32767)));
}

function audioDataToWavBuffer(audioData) {
    // 创建数据缓冲区
    const buffer = Buffer.alloc(audioData.length * 2); // 16-bit = 2 bytes per sample
    
    // 将浮点音频数据转换为 16 位整数并写入缓冲区
    for (let i = 0; i < audioData.length; i++) {
        const intValue = floatToInt16(audioData[i]);
        buffer.writeInt16LE(intValue, i * 2);
    }
    
    return buffer;
}

async function generateWavFile(startTime, endTime, outputFile) {
    try {
        // 1. 获取音频数据
        const audioData = await fetchAudioData(startTime, endTime);
        console.log(`Fetched ${audioData.length} samples`);
        
        // 2. 创建 WAV 文件内容
        const dataBuffer = audioDataToWavBuffer(audioData);
        const header = createWavHeader(audioData.length);
        
        // 3. 合并头和音频数据
        const wavBuffer = Buffer.concat([header, dataBuffer]);
        
        // 4. 写入文件
        fs.writeFileSync(outputFile, wavBuffer);
        console.log(`WAV file saved to ${outputFile}`);
    } catch (error) {
        console.error('Error generating WAV file:', error);
    }
}

// 使用示例
const START_TIME = "0.000";
const END_TIME = "2.500";
const OUTPUT_FILE = "output.wav";

generateWavFile(START_TIME, END_TIME, OUTPUT_FILE);

```


## 四、进阶

### 1、浏览器里订阅事件

```js
// 浏览器里 console 里面粘贴下面的代码
const eventSource = new EventSource("http://localhost:35123/events");
eventSource.onopen = (e) => console.log("Connection opened", e);
eventSource.onerror = (e) => console.log("Connection error", e);
eventSource.addEventListener("captions", (e) => {
  console.log("captions:", JSON.parse(e.data));
});
eventSource.addEventListener("translate", (e) => {
  console.log("translate:", JSON.parse(e.data));
});
```

### 2、订阅事件

#### captions 事件

```json
// 1
{
  "index": 0, // 行号
  "captions": {
    "startTime": 0.098, // 开始时间
    "endTime": 1.2599999904632568, // 结束时间
    "text": "的老师快转吧。", // 语音转出来的文本
    "subSegments": [ // 子片段，为了实现实时效果，最后一个 index 的 text 可能还会变动
      {
        "index": 0,
        "startTime": 0.098,
        "endTime": 1.2599999904632568,
        "text": "的老师快转吧。"
      }
    ],
    "fixed": false // 是否固定下来了，固定的话就不会变动
  }
}

// 2
{
  "index": 0,
  "captions": {
    "startTime": 0.1640000194311142,
    "endTime": 16.47599828720093,
    "text": "的老师快转吧，我们上车了，看看能转多久。那么现在的问题是啊，我们怎么开出去呢？哎呀，怎么说？ 他们造完才发现，他们压根没想这事儿，棚子里造的门太小，开不过去。就是你说因为他造这个实验，他这个门儿。",
    "subSegments": [
      {
        "index": 0,
        "startTime": 0.1640000194311142,
        "endTime": 6.722000019431114,
        "text": "的老师快转吧，我们上车了，看看能转多久。那么现在的问题是啊，我们怎么开出去呢？哎呀，怎么说？"
      },
      {
        "index": 1,
        "startTime": 6.845998287200928,
        "endTime": 16.47599828720093,
        "text": "他们造完才发现，他们压根没想这事儿，棚子里造的门太小，开不过去。就是你说因为他造这个实验，他这个门儿。"
      }
    ],
    "fixed": true,
    "translateText": "Let's get on the bus and see how long we can turn. So the question now is, how do we drive out? Oops, how to say?"
  }
}

// 3
{
  "index": 1,
  "captions": {
    "startTime": 16.833997741699218,
    "endTime": 18.70006024169922,
    "text": "早些不想好自己零家咔咔。",
    "subSegments": [
      {
        "index": 2,
        "startTime": 16.833997741699218,
        "endTime": 18.70006024169922,
        "text": "早些不想好自己零家咔咔。"
      }
    ],
    "fixed": false
  }
}

```

#### translate 事件

> ⚠️ 翻译的过程是异步的，可能会有一定的延迟，需要按照 index 来更新字幕

```json
// 1
{
  "index": 0,
  "captions": {
    "startTime": 0.1640000194311142,
    "endTime": 16.47599828720093,
    "text": "的老师快转吧，我们上车了，看看能转多久。那么现在的问题是啊，我们怎么开出去呢？哎呀，怎么说？ 他们造完才发现，他们压根没想这事儿，棚子里造的门太小，开不过去。就是你说因为他造这个实验，他这个门儿。",
    "subSegments": [
      {
        "index": 0,
        "startTime": 0.1640000194311142,
        "endTime": 6.722000019431114,
        "text": "的老师快转吧，我们上车了，看看能转多久。那么现在的问题是啊，我们怎么开出去呢？哎呀，怎么说？"
      },
      {
        "index": 1,
        "startTime": 6.845998287200928,
        "endTime": 16.47599828720093,
        "text": "他们造完才发现，他们压根没想这事儿，棚子里造的门太小，开不过去。就是你说因为他造这个实验，他这个门儿。"
      }
    ],
    "fixed": true,
    "translateText": "Let's get on the bus and see how long we can turn. So the question now is, how do we drive out? Oops, how to say? When they finished building, they found that they hadn't thought about it at all, and the door in the shed was too small to open. That's what you said because he made this experiment, because he made this door."
  }
}

// 2
{
  "index": 1,
  "captions": {
    "startTime": 16.83399772644043,
    "endTime": 27.700060455322266,
    "text": "早些不想好，自己零家咔咔噔拼起来来，发现诶。 这个门太小了，开不出去。也从另一个层面也说做事专注啊，就没想别的事儿，就想先怎么么把这个车弄出来，也很难想象是发明家。",
    "subSegments": [
      {
        "index": 2,
        "startTime": 16.83399772644043,
        "endTime": 19.71199772644043,
        "text": "早些不想好，自己零家咔咔噔拼起来来，发现诶。"
      },
      {
        "index": 3,
        "startTime": 19.845997955322265,
        "endTime": 27.700060455322266,
        "text": "这个门太小了，开不出去。也从另一个层面也说做事专注啊，就没想别的事儿，就想先怎么么把这个车弄出来，也很难想象是发明家。"
      }
    ],
    "fixed": false,
    "translateText": "I didn't want to be good earlier, so I put it together and found it."
  }
}

```

### 3、字幕处理

- 创建一个数组 lines 并根据 index 维护;
- 每当有订阅事件过来，更新此 index 的元素；
- 将 lines 数组渲染到页面上。参考代码如下：

```js
{
  line.subSegments
    ? line.subSegments.map((item: CaptionModel, index: number) => {
        return (
          <span
            key={index}
            style={{
              opacity:
                !line.fixed && index == line.subSegments.length - 1 ? 0.5 : 1,
            }}
          >
            {item.text}
          </span>
        );
      })
    : line.text;
}
```

### 4、端口号

- 默认端口号：35123


### 5、音频样本

```
// microphone
{
    "0": 0.007925044745206833,
    "1": 0.00844472087919712,
    "2": 0.00890952069312334,
    "3": 0.00902735348790884,
    ...
    "47997": -0.05906456708908081,
    "47998": -0.0625472143292427,
    "47999": -0.06326194107532501
}

// system audio
{
    "0": -0.020384743809700012,
    "1": -0.02918463572859764,
    "2": -0.03867190703749657,
    "3": -0.04862762615084648,
    "4": -0.05701787769794464,
    "5": -0.06138741225004196,
    ...
    "957": 0.07351797074079514,
    "958": 0.0706319659948349,
    "959": 0.06783906370401382
}
```

> 注意⚠️：采样率都为 48000Hz。处理的时候区分下 microphone 是每秒回 48000 个点，其他的是分多次回，每次 960 个点。

## 五、附录

### 1、错误码

| 错误码 | 描述         |
| ------ | ------------ |
| 200    | 成功         |
| 500    | 失败         |
| 5001   | 已经开始转录 |
| 5002   | 还未开始转录 |
| 5003   | 参数错误     |

### 2、内置模型列表

> ⚠️ 模型使用前需要提前下载到本地

| model               | lang                        | tag                                   | repo                  | repoFile                        | desc                                                                                              | disk   | size       | mem     | sha                                      |
| ------------------- | --------------------------- | ------------------------------------- | --------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------- | ------ | ---------- | ------- | ---------------------------------------- |
| tiny                |                             | ["realtime", "tiny"]                  | ggerganov/whisper.cpp | ggml-tiny.bin                   | Very fast but bad accuracy                                                                        | 75 MB  | 77691713   | ~390 MB | bd577a113a864445d4c299885e0cb97d4ba92b5f |
| tiny.en             | ["en"]                      | ["realtime", "tiny"]                  | ggerganov/whisper.cpp | ggml-tiny.en.bin                | Very fast but bad accuracy. English only.                                                         | 75 MB  | 77704715   | ~390 MB | c78c86eb1a8faa21b369bcd33207cc90d64ae9df |
| base                |                             | ["realtime", "base"]                  | ggerganov/whisper.cpp | ggml-base.bin                   | Fast with decent accuracy                                                                         | 142 MB | 147951465  | ~500 MB | 465707469ff3a37a2b9b8d8f89f2f99de7299dac |
| base.en             | ["en"]                      | ["realtime", "base"]                  | ggerganov/whisper.cpp | ggml-base.en.bin                | Fast with decent accuracy. English only.                                                          | 142 MB | 147964211  | ~500 MB | 137c40403d78fd54d454da0f9bd998f78703390c |
| sensevoice.small    | ["zh","en","yue","ja","ko"] | ["realtime","sensevoice","quantized"] | xumo/sense-voice-gguf | gguf-fp16-sense-voice-small.bin | Experimental. SenseVoice Small is an open-source speech recognition model developed by Alibaba... | 466 MB | 469406560  | ~1.0 GB | 8176595ec830f32f385ca6d28ad86008db88de32 |
| small               |                             | ["realtime", "small"]                 | ggerganov/whisper.cpp | ggml-small.bin                  | Normal speed with good accuracy                                                                   | 466 MB | 487601967  | ~1.0 GB | 55356645c2b361a969dfd0ef2c5a50d530afd8d5 |
| small.en            | ["en"]                      | ["realtime", "small"]                 | ggerganov/whisper.cpp | ggml-small.en.bin               | Normal speed with good accuracy. English only.                                                    | 466 MB | 487614201  | ~1.0 GB | db8a495a91d927739e50b3fc1cc4c6b8f6c2d022 |
| medium              |                             | ["medium"]                            | ggerganov/whisper.cpp | ggml-medium.bin                 | Warning: Only suitable for file transcription (coming soon). Slow but great accuracy              | 1.5 GB | 1533763059 | ~2.6 GB | fd9727b6e1217c2f614f9b698455c4ffd82463b4 |
| ggml-medium-q5_0    |                             | ["medium", "quantized"]               | ggerganov/whisper.cpp | ggml-medium-q5_0.bin            | Slow but great accuracy                                                                           | 539 MB | 539212467  | ~1.0 GB | 7718d4c1ec62ca96998f058114db98236937490e |
| medium.en           | ["en"]                      | ["medium"]                            | ggerganov/whisper.cpp | ggml-medium.en.bin              | Warning: Only suitable for file transcription (coming soon). Slow but great accuracy              | 1.5 GB | 1533774781 | ~2.6 GB | 8c30f0e44ce9560643ebd10bbe50cd20eafd3723 |
| large-v3-turbo-q5_0 |                             | ["realtime", "large"]                 | ggerganov/whisper.cpp | ggml-large-v3-turbo-q5_0.bin    | Whisper large-v3-turbo is a finetuned version of a pruned Whisper large-v3.                       | 574 MB | 574041195  | ~?? GB  | e050f7970618a659205450ad97eb95a18d69c9ee |
| large-v2            |                             | ["large"]                             | ggerganov/whisper.cpp | ggml-large-v2.bin               | Warning: Only suitable for file transcription (coming soon). Most accurate transcription...       | 2.9 GB | 3094623691 | ~4.7 GB | 0f4c8e34f21cf1a914c59d8b3ce882345ad349d6 |
| large-v3            |                             | ["large"]                             | ggerganov/whisper.cpp | ggml-large-v3.bin               | Warning: Only suitable for file transcription (coming soon). Most accurate transcription...       | 2.9 GB | 3095033483 | ~4.7 GB | ad82bf6a9043ceed055076d0fd39f5f186ff8062 |
| ggml-large-v2-q5_0  |                             | ["large", "quantized"]                | ggerganov/whisper.cpp | ggml-large-v2-q5_0.bin          | Most accurate transcription, updated model but can have repetition in transcript                  | 1.1 GB | 1080732091 | 2 GB    | 00e39f2196344e901b3a2bd5814807a769bd1630 |

### 3、语言列表

> ⚠️ 以下两个是特殊的 code
>
> - auto 是指音频语言由语音模型自动检测。【仅音频语言使用】
> - n/a 是指翻译语言不需要翻译。【仅翻译语言使用】

| code     | name                  | displayName      | whisperCode | whisperPrompt        | bingCode | googleCode |
| -------- | --------------------- | ---------------- | ----------- | -------------------- | -------- | ---------- |
| auto     | Auto                  | Auto-Detect      |             |                      |          |            |
| n/a      | n/a                   | None             |             |                      |          |            |
| en       | English               | English          | en          |                      | en       | en         |
| zh-Hans  | Chinese Simplified    | 简体中文         | zh          | 以下是普通话的句子。 | zh-Hans  | zh-CN      |
| zh-Hant  | Chinese Traditional   | 繁體中文         | zh          | 以下是普通話的句子。 | zh-Hant  | zh-TW      |
| de       | German                | Deutsch          | de          |                      | de       | de         |
| es       | Spanish               | Español          | es          |                      | es       | es         |
| ru       | Russian               | Русский          | ru          |                      | ru       | ru         |
| ko       | Korean                | 한국어           | ko          |                      | ko       | ko         |
| fr       | French                | Français         | fr          |                      | fr       | fr         |
| ja       | Japanese              | 日本語           | ja          |                      | ja       | ja         |
| pt       | Portuguese            | Português        | pt          |                      | pt       | pt         |
| tr       | Turkish               | Türkçe           | tr          |                      | tr       | tr         |
| pl       | Polish                | Polski           | pl          |                      | pl       | pl         |
| ca       | Catalan               | Català           | ca          |                      | ca       | ca         |
| nl       | Dutch                 | Nederlands       | nl          |                      | nl       | nl         |
| ar       | Arabic                | العربية          | ar          |                      | ar       | ar         |
| sv       | Swedish               | Svenska          | sv          |                      | sv       | sv         |
| it       | Italian               | Italiano         | it          |                      | it       | it         |
| id       | Indonesian            | Bahasa Indonesia | id          |                      | id       | id         |
| hi       | Hindi                 | हिन्दी           | hi          |                      | hi       | hi         |
| fi       | Finnish               | Suomi            | fi          |                      | fi       | fi         |
| vi       | Vietnamese            | Tiếng Việt       | vi          |                      | vi       | vi         |
| he       | Hebrew                | עברית            | he          |                      | he       | null       |
| uk       | Ukrainian             | Українська       | uk          |                      | uk       | uk         |
| el       | Greek                 | Ελληνικά         | el          |                      | el       | el         |
| ms       | Malay                 | Bahasa Melayu    | ms          |                      | ms       | ms         |
| cs       | Czech                 | Čeština          | cs          |                      | cs       | cs         |
| ro       | Romanian              | Română           | ro          |                      | ro       | ro         |
| da       | Danish                | Dansk            | da          |                      | da       | da         |
| hu       | Hungarian             | Magyar           | hu          |                      | hu       | hu         |
| ta       | Tamil                 | தமிழ்            | ta          |                      | ta       | ta         |
| no       | Norwegian             | Norsk            | no          |                      | null     | no         |
| th       | Thai                  | ไทย              | th          |                      | th       | th         |
| ur       | Urdu                  | اردو             | ur          |                      | ur       | ur         |
| hr       | Croatian              | Hrvatski         | hr          |                      | hr       | hr         |
| bg       | Bulgarian             | Български        | bg          |                      | bg       | bg         |
| lt       | Lithuanian            | Lietuvių         | lt          |                      | lt       | lt         |
| la       | Latin                 | null             | la          |                      | null     | la         |
| mi       | Maori                 | Māori            | mi          |                      | mi       | mi         |
| ml       | Malayalam             | മലയാളം           | ml          |                      | ml       | ml         |
| cy       | Welsh                 | Cymreig          | cy          |                      | cy       | cy         |
| sk       | Slovak                | Slovenčina       | sk          |                      | sk       | sk         |
| te       | Telugu                | తెలుగు           | te          |                      | te       | te         |
| fa       | Persian               | فارسی            | fa          |                      | fa       | fa         |
| lv       | Latvian               | Latviešu         | lv          |                      | lv       | lv         |
| bn       | Bengali               | বাঙ্গালি         | bn          |                      | bn       | bn         |
| sr       | Serbian               | Српски           | sr          |                      | null     | sr         |
| az       | Azerbaijani           | Azərbaycan       | az          |                      | az       | az         |
| sl       | Slovenian             | Slovenščina      | sl          |                      | sl       | sl         |
| kn       | Kannada               | ಕನ್ನಡ            | kn          |                      | kn       | kn         |
| et       | Estonian              | Eesti            | et          |                      | et       | et         |
| mk       | Macedonian            | Македонски       | mk          |                      | mk       | mk         |
| br       | Breton                | null             | br          |                      | null     | null       |
| eu       | Basque                | Euskaldun        | eu          |                      | eu       | eu         |
| is       | Icelandic             | Íslenska         | is          |                      | is       | is         |
| hy       | Armenian              | Հայերեն          | hy          |                      | hy       | hy         |
| ne       | Nepali                | नेपाली           | ne          |                      | ne       | ne         |
| mn       | Mongolian             | null             | mn          |                      | null     | mn         |
| bs       | Bosnian               | Bosanski         | bs          |                      | bs       | bs         |
| kk       | Kazakh                | Қазақша          | kk          |                      | kk       | kk         |
| sq       | Albanian              | Shqip            | sq          |                      | sq       | sq         |
| sw       | Swahili               | Kiswahili        | sw          |                      | sw       | sw         |
| gl       | Galician              | GALEGO           | gl          |                      | gl       | gl         |
| mr       | Marathi               | मराठी            | mr          |                      | mr       | mr         |
| pa       | Punjabi               | ਪੰਜਾਬੀ           | pa          |                      | pa       | pa         |
| si       | Sinhala               | සිංහල            | si          |                      | si       | si         |
| km       | Khmer                 | ខ្មែរ            | km          |                      | km       | km         |
| sn       | Shona                 | Shona            | sn          |                      | sn       | sn         |
| yo       | Yoruba                | Yoruba           | yo          |                      | yo       | yo         |
| so       | Somali                | Soomaalida       | so          |                      | so       | so         |
| af       | Afrikaans             | Afrikaans        | af          |                      | af       | af         |
| oc       | Occitan               | null             | oc          |                      | null     | null       |
| ka       | Georgian              | ქართული          | ka          |                      | ka       | ka         |
| be       | Belarusian            | null             | be          |                      | null     | be         |
| tg       | Tajik                 | null             | tg          |                      | null     | tg         |
| sd       | Sindhi                | سنڌي             | sd          |                      | sd       | sd         |
| gu       | Gujarati              | ગુજરાતી          | gu          |                      | gu       | gu         |
| am       | Amharic               | አማርኛ             | am          |                      | am       | am         |
| yi       | Yiddish               | null             | yi          |                      | null     | yi         |
| lo       | Lao                   | Lao              | lo          |                      | lo       | lo         |
| uz       | Uzbek                 | O'zbek tili      | uz          |                      | uz       | uz         |
| fo       | Faroese               | Føroyskt         | fo          |                      | fo       | null       |
| ht       | Haitian Creole        | Kreyòl Ayisyen   | ht          |                      | ht       | ht         |
| ps       | Pashto                | پښتو             | ps          |                      | ps       | ps         |
| tk       | Turkmen               | Türkmençe        | tk          |                      | tk       | tk         |
| nn       | Nynorsk               | null             | nn          |                      | null     | null       |
| mt       | Maltese               | Malti            | mt          |                      | mt       | mt         |
| sa       | Sanskrit              | null             | sa          |                      | null     | sa         |
| lb       | Luxembourgish         | null             | lb          |                      | null     | lb         |
| my       | Myanmar               | မြန်မာနိုင်ငံ    | my          |                      | my       | my         |
| bo       | Tibetan               | བོད་སྐད།         | bo          |                      | bo       | null       |
| tl       | Tagalog               | null             | tl          |                      | null     | tl         |
| mg       | Malagasy              | Malagasy         | mg          |                      | mg       | mg         |
| as       | Assamese              | অসমীয়া          | as          |                      | as       | as         |
| tt       | Tatar                 | Татар            | tt          |                      | tt       | tt         |
| haw      | Hawaiian              | null             | haw         |                      | null     | haw        |
| ln       | Lingala               | Lingala Lingala  | ln          |                      | ln       | ln         |
| ha       | Hausa                 | Hausa            | ha          |                      | ha       | ha         |
| ba       | Bashkir               | Башҡорттар       | ba          |                      | ba       | null       |
| jw       | Javanese              | null             | jw          |                      | null     | null       |
| su       | Sundanese             | null             | su          |                      | null     | su         |
| yue-Hans | Cantonese Simplified  | 简体粤语         | yue         | 以下是普通话的句子。 | yue      | null       |
| yue-Hant | Cantonese Traditional | 繁體粤语         | yue         | 以下是普通話的句子。 | yue      | null       |

## 六、相关链接

- Server-Sent Events
  - [mdn web docs](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
  - [ruanyifeng.com](https://www.ruanyifeng.com/blog/2017/05/server-sent_events.html)
