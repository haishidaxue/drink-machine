# -*- coding: utf-8 -*-
"""v27 修复：v27 替换语音块时误删了商用登录/个性化 COMM 块，重新插回。"""
import io,re
BASE="/Coze/Drive/扣子/所有对话/主对话/饮料机小程序/"
src=io.open(BASE+"patch_voice_login.py",encoding="utf-8").read()
# 从 COMM=r''' ... ''' 中取出原始内容
m=re.search(r"COMM=r'''\n(.*?)\n'''",src,re.S)
assert m,"未找到 COMM"
COMM=m.group(1)
path=BASE+"公开展示_商用版/index.html"
s=io.open(path,encoding="utf-8").read()
assert s.count("var AUTH=")==0 and s.count("function dailyPick(")==0,"COMM 已存在，勿重复插入"
anchor="function buildFlavor(rawText){"
assert s.count(anchor)==1
s=s.replace(anchor,COMM+"\n"+anchor,1)
io.open(path,"w",encoding="utf-8").write(s)
print("reinserted, len",len(s))
for k in ["var AUTH=","function bindLogin","T.login=","function dailyPick(","function dailyPitchText(","function _festival(","function _authEnter("]:
    print(k,s.count(k))
