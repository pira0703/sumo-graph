#!/usr/bin/env python3
"""Batch 1 episode data updates for wiki_episodes_progress.json"""
import json, datetime

UPDATES = {
    "be678a13-4b45-4abe-8eff-d5e87ec52e6f": {  # 一山本
        "birth_date": "1993-10-01", "active_from_basho": "2017-01",
        "high_school": "大野農業高校", "university": "中央大学",
        "episodes": "北海道岩内町出身。中央大学卒業後に北海道福島町役場の教育委員会へ就職し、横綱千代の山・千代の富士記念館でコーチとして相撲普及に携わった。元幕下・神光の誘いで大相撲入りを決意し、年齢制限緩和制度の第1号適用者として23歳2ヶ月で初土俵。公務員から角界への転身という前例なき経歴が大きな話題を呼んだ。",
        "status": "done"
    },
    "df1a3f2e-8f72-4f73-a31d-27cfc0c4a6c6": {  # 丸勝(臥牙丸)
        "birth_date": "1987-02-23", "active_from_basho": "2005-11",
        "high_school": None, "university": None,
        "episodes": "ジョージア（旧グルジア）の首都トビリシ出身。バルセロナ五輪柔道金メダリスト・ハハレイシヴィリに師事し世界ジュニア相撲選手権無差別級3位の実績を持つ。師匠・木瀬が「武蔵丸のように成功を」と願い命名した四股名「臥牙丸」を背負い2005年11月場所に初土俵。現在はタレント・YouTuberとして活躍中。",
        "status": "done"
    },
    "58924e57-e139-404c-aa32-6548f9d5a4fd": {  # 佐田の海
        "birth_date": "1987-05-11", "active_from_basho": "2003-03",
        "high_school": None, "university": None,
        "episodes": "元小結・佐田の海の長男として生まれ、父の四股名を2004年1月場所から継承。父の弟弟子・13代境川が師匠を務める境川部屋に「男を磨くならこの部屋だ」という父の言葉で中学卒業後入門。2010年7月場所には史上9組目の親子関取となり、父から受け継いだ名前と縁が結んだ絆を土俵で証明した。",
        "status": "done"
    },
    "2a4ab04d-3b9a-446c-a8e9-10a17ecae2f7": {  # 出羽ノ龍
        "birth_date": "2001-03-07", "active_from_basho": "2019-11",
        "high_school": "希望が丘高校", "university": None,
        "episodes": "モンゴル・ウランバートル出身。朝青龍・日馬富士に憧れ8歳から相撲を始め、日本の希望が丘高校に相撲留学。初土俵同期は夢道鵬と二本栁の三人組で切磋琢磨し、2026年1月場所についに新十両昇進。元幕下・北春日や前乃雄という師から学んだ基礎が長い幕下修行を支えた。",
        "status": "done"
    },
    "a84aa163-ae5b-4011-99eb-fda423863523": {  # 剣翔
        "birth_date": "1991-07-27", "active_from_basho": "2013-09",
        "high_school": "埼玉栄高校", "university": "日本大学",
        "episodes": "東京都葛飾区出身。幼馴染の翔猿と共に葛飾白鳥相撲教室で育ち、同学年の千代嵐とは小学生時代から顔を合わせた。埼玉栄高校では先輩英乃海・同期翔猿と肩を並べ団体優勝を経験。日大でも翔猿と同期として過ごした「葛飾つながり」が力士の道を歩む原動力となった。",
        "status": "done"
    },
    "53404376-98fa-4c60-85d7-813fdee57aac": {  # 勇磨
        "birth_date": "1998-06-13", "active_from_basho": "2014-03",
        "high_school": None, "university": None,
        "episodes": "大阪府枚方市出身。母が女手一つで3兄弟を育て、弟・勇聖も同じ阿武松部屋に入門した兄弟相撲取り。左膝前十字靭帯断裂・左手舟状骨骨折など幾度もの大怪我を乗り越え、師匠・13代阿武松の細やかな指導と古傷への配慮に支えられて土俵を守り続ける不屈の力士。",
        "status": "done"
    },
    "265c9f53-7bd0-4916-9388-9c2fe6dd764f": {  # 北の若
        "birth_date": "2000-11-12", "active_from_basho": "2019-03",
        "high_school": "埼玉栄高校", "university": None,
        "episodes": "山形県酒田市出身の高校横綱。小学生時代のわんぱく相撲で八角部屋に宿泊し大岩戸らに優しくされた記憶が入門先決定の原点。さらに酒田市の飲食店で北の富士に声をかけられ、入門の表敬訪問にも北の富士が同行。「北の富士の秘蔵っ子」として四股名も親方から命名された深い縁を持つ。",
        "status": "done"
    },
    "22c93688-ed7d-4ea2-bd72-ed19fbc2f715": {  # 北天海
        "birth_date": "1999-02-02", "active_from_basho": "2019-07",
        "high_school": "埼玉栄高校", "university": None,
        "episodes": "モンゴル・ウランバートル出身。元幕内・貴ノ岩は叔父で、叔父から贈られたDVDで北天佑の相撲に魅了され尾上部屋に入門。高校同期に琴勝峰がいる。師匠・尾上が「北天佑への憧れ」を汲み取り命名した「北天海」は「モンゴルから海を渡って来た」意味が込められた四股名。",
        "status": "done"
    },
    "35c7c190-fa8c-4fbd-9d95-3fc5a778d6ea": {  # 千代ノ皇
        "birth_date": "1991-05-29", "active_from_basho": "2010-03",
        "high_school": "沖縄県立中部農林高校", "university": None,
        "episodes": "鹿児島県与論島出身。相撲が盛んな与論島で育ち「親孝行がしたい」と九重部屋入門。千代大海が「気が優しく力持ちで魁皇のよう」と評したことが四股名の「皇」の由来。高校時代は2年間部活の後輩の実家に下宿し、好物のアイスとマカロニサラダを振る舞われた温かい縁も持つ。",
        "status": "done"
    },
    "b2b83052-eef1-43e3-9ba9-27471f8727e1": {  # 千代丸
        "birth_date": "1991-04-17", "active_from_basho": "2007-05",
        "high_school": None, "university": None,
        "episodes": "鹿児島県志布志市出身。実弟は元小結・千代鳳（13代大山）で史上17組目の兄弟関取。2011年の実家全焼後、弟と「2人で新しい家を建てたい」と誓い合い奮起。一時は弟の付け人として仕え、弟・千代鳳の活躍が兄自身の関取昇進への強い原動力となった絆の物語。",
        "status": "done"
    },
    "f2b4d258-51b5-440d-94df-07f0fcf13a3b": {  # 千代大豪
        "birth_date": "1998-02-28", "active_from_basho": "2016-07",
        "high_school": None, "university": None,
        "episodes": "兵庫県尼崎市出身。空手・総合格闘技からアームレスリング全国準優勝まで経た異色の経歴。「相撲が最も力を使う格闘技」と確信し、元横綱・千代の富士を「成功の象徴」として崇める思いから九重部屋入門。前相撲で後の對馬洋に張り手を連打し脳震盪を起こさせた逸話も持つ豪快な力士。",
        "status": "done"
    },
    "70cf7171-2f5a-4695-9bfb-aab91a46a7fe": {  # 千代栄
        "birth_date": "1990-07-12", "active_from_basho": "2009-01",
        "high_school": "京都共栄学園高校", "university": None,
        "episodes": "京都府福知山市出身。柔道出身で相撲未経験のまま「普通じゃない人生を送りたい」と九重部屋入門。千代大海のファンだったことも入門動機の一つ。幕下で57場所という長い修行を経て「相撲しかないよな」と心が折れそうになりながらも耐え、2022年7月場所に福知山市史上初の関取として新十両昇進を果たした。",
        "status": "done"
    },
    "10892bd8-daa3-4187-9a86-da81bca70aba": {  # 千代翔馬
        "birth_date": "1991-07-20", "active_from_basho": "2009-07",
        "high_school": "明徳義塾高校", "university": None,
        "episodes": "モンゴル出身。父はモンゴル相撲の大関で、父と朝青龍の父が知人という縁で角界入りし明徳義塾高校に留学して初土俵。初土俵同期に碧山がいる。入門当初は同部屋の千代ノ皇・千代丸に水をあけられた悔しさをバネに稽古に打ち込み、後に日本国籍を取得して西前頭2枚目まで昇進した。",
        "status": "done"
    },
    "87dd8d0c-a1a6-47d3-874f-ee37d3196820": {  # 友風
        "birth_date": "1994-12-02", "active_from_basho": "2017-05",
        "high_school": "向の岡工業高校", "university": "日本体育大学",
        "episodes": "神奈川県川崎市出身。日体大時代に尾車部屋の嘉風から技術指導を受け、師・嘉風が所属する尾車部屋に入門。右膝下切断寸前の重傷で幕内から序二段まで陥落する試練を乗り越え、幕内へ奇跡の復帰を果たした。師弟の縁と不屈の精神が「前代未聞の復活劇」を支えた。",
        "status": "done"
    },
    "bdb16778-cffc-442b-a742-b695ec6766c2": {  # 吉井
        "birth_date": "2003-08-01", "active_from_basho": "2019-03",
        "high_school": None, "university": None,
        "episodes": "静岡県焼津市出身。中学生横綱として全国中学校選手権を制し、小学5年から「中卒入門」を決意していた一途な力士。全中決勝でライバル大辻を破って横綱に輝いた翌年、宿命の相手・大辻と共に2019年3月場所で初土俵。47人の中学生横綱のうち稀な中卒入門を貫いた。",
        "status": "done"
    },
    "9785c658-e87c-4d01-b6e0-2bf2e8d02c1f": {  # 名島 → skip (名島城の記事)
        "status": "skip"
    },
    "2f4ca91e-6e02-4d2c-bff5-94062df6deb6": {  # 土佐緑
        "birth_date": "1996-05-11", "active_from_basho": "2015-07",
        "high_school": "埼玉栄高校", "university": None,
        "episodes": "高知市出身。埼玉栄高校では貴景勝と同期として共に稽古を積んだ。両肩・膝への手術と長期休場を幾度も乗り越え土俵に復帰し続けた不屈の力士。2018年11月場所に序二段優勝を果たした直後、幕内土俵入りを終えた同期・貴景勝からグータッチで祝福を受けた師友の絆が心の支えになっている。",
        "status": "done"
    },
    "2910d3d5-80ca-4558-ac7b-6d38993f42bb": {  # 夢道鵬
        "birth_date": "2001-09-18", "active_from_basho": "2019-11",
        "high_school": "埼玉栄高校", "university": None,
        "episodes": "第48代横綱・大鵬の孫で元関脇・貴闘力の四男。三兄・王鵬と同じ大嶽部屋に入門し初土俵同期に出羽ノ龍・二本栁がいる。四股名は大鵬の好きな字「夢」、高校監督の名前から「道」、大鵬の四股名から「鵬」を合わせた。大横綱の血脈を継ぎながら兄弟と共に土俵を歩む。",
        "status": "done"
    },
    "25cc2234-beff-45a1-8cd8-99ea9751b88f": {  # 大の里
        "birth_date": "2000-06-07", "active_from_basho": "2023-05",
        "high_school": "新潟県立海洋高校", "university": "日本体育大学",
        "episodes": "石川県津幡町出身の第75代横綱。中学相撲留学で地元から「裏切り者」と言われ父子で辛い思いをしながらも日体大でアマチュア横綱2連覇を達成。師匠は元横綱・稀勢の里。入門わずか10場所で大関、翌5場所で横綱と相撲史上最速に迫るスピードで頂点を極めた令和の大横綱。",
        "status": "done"
    },
    "1eccc96e-8f3a-45c6-8e50-97db476a59ad": {  # 大栄翔
        "birth_date": "1993-11-10", "active_from_basho": "2012-01",
        "high_school": "埼玉栄高校", "university": None,
        "episodes": "埼玉県朝霞市出身。母子家庭で「親に楽をさせたい」という思いを胸に埼玉栄から追手風部屋へ入門。2013年に同部屋の遠藤が史上最速で幕内昇進するのを間近で見て大いに発奮。日々遠藤の背中を追い続けた切磋琢磨の日々が、自身の関脇定着という結実につながった。",
        "status": "done"
    },
    "9b9ba74e-f50e-4749-8833-4a7c1c7abb39": {  # 大畑
        "birth_date": "1996-10-24", "active_from_basho": "2014-11",
        "high_school": "小牛田農林高校", "university": None,
        "episodes": "宮城県栗原市出身。高校相撲部監督の大学時代の先輩が16代時津風（元幕内・時津海）という縁で時津風部屋入門。幕下昇進後に糖尿病悪化に苦しみながらも三段目優勝で立て直し、双葉山・北葉山ゆかりの「葉」の字を含む四股名「大葉山」を一時名乗るも本名「大畑」に回帰した誠実な力士。",
        "status": "done"
    },
    "767fc6ce-9b85-481e-a903-b4ddc93c63c9": {  # 大翔
        "birth_date": "1991-07-10", "active_from_basho": "2014-03",
        "high_school": "金沢学院東高校", "university": "日本大学",
        "episodes": "大阪市平野区出身。明徳義塾中・金沢学院東高・日大でアマチュア横綱となり幕下格付出資格を取得。高校・大学1年先輩の遠藤が所属する追手風部屋に入門し「アマチュア横綱が2年続けて同部屋入門した初ケース」として話題に。先輩・遠藤との師兄弟の絆が入門先を決めた。",
        "status": "done"
    },
    "c796993c-86cd-4af4-814f-b4c98fe8b9c5": {  # 大翔丸
        "birth_date": "1991-07-10", "active_from_basho": "2014-03",
        "high_school": "金沢学院東高校", "university": "日本大学",
        "episodes": "大阪市平野区出身。明徳義塾中・金沢学院東高・日大でアマチュア横綱となり幕下格付出資格を取得。高校・大学1年先輩の遠藤が所属する追手風部屋に入門し「アマチュア横綱が2年続けて同部屋入門した初ケース」として話題に。先輩・遠藤との師兄弟の絆が入門先を決めた。",
        "status": "done"
    },
    "016dce7f-75e4-44c8-a288-3dfd0de4e0d3": {  # 大翔鵬
        "birth_date": "1994-08-28", "active_from_basho": "2013-07",
        "high_school": "千葉県立流山南高校", "university": None,
        "episodes": "モンゴル出身で幼少期に千葉へ移住。流山南高校同期に阿炎がおり、1年次の千葉新人戦では個人優勝（2位は阿炎）と同期ライバルとして競い合った。追手風部屋に入門後も先輩・遠藤の背中を追い稽古に励んで最高位西前頭9枚目を達成。引退後もYouTube活動などで活躍中。",
        "status": "done"
    },
    "0330266e-d739-4cbc-bcbf-f68901be9dfb": {  # 大辻
        "birth_date": "2003-10-06", "active_from_basho": "2019-03",
        "high_school": None, "university": None,
        "episodes": "兵庫県加古川市出身。小学生から母と9代高田川の親族が知り合いという縁を頼りに高田川部屋入門を決意。初土俵の2019年3月場所の同期は全中決勝で自分を破った吉井。宿命のライバルと同じ日に土俵に上がり共に関取を目指して成長した。2025年7月場所に新十両昇進。",
        "status": "done"
    },
    "c7d34e0f-b76f-477a-be05-a327cc7e4287": {  # 大雷童
        "birth_date": "1980-04-17", "active_from_basho": "1996-03",
        "high_school": None, "university": None,
        "episodes": "福岡県大野城市出身。1996年3月場所初土俵の大ベテラン。初土俵から連続出場881回という鉄人記録を誇り、大相撲八百長問題での場所中止を機に「鍛え直し」を決意した気骨の力士。40歳を超えても高田川部屋で後輩たちと共に稽古を積み、30年以上の長きにわたり土俵に立ち続けている。",
        "status": "done"
    },
    "0b927c8c-2db7-495e-baee-56e041ddb000": {  # 天一
        "birth_date": "1977-11-22", "active_from_basho": "1993-03",
        "high_school": None, "university": None,
        "episodes": "新潟県南魚沼市出身。1993年3月場所初土俵で2025年7月場所以降は現役最古参力士。入門同期に北勝力・皇司らがいる。2000年頃から5年間初切を担当し、覆面力士として乱入したユーモア溢れるエピソードも。2025年11月場所は32年ぶりの序ノ口在位となるも勝ち越して復帰した不屈の闘士。",
        "status": "done"
    },
    "d7c153d5-7954-421c-a901-01eeb6719844": {  # 天空海
        "birth_date": "1990-11-06", "active_from_basho": "2010-11",
        "high_school": "那珂湊第一高校", "university": None,
        "episodes": "茨城県大洗町出身。同郷・稀勢の里の活躍に感化され立浪部屋入門を志した。東日本大震災で地元大洗が津波の甚大な被害を受け力士の道を断念しかけたが、父の励ましで2011年4月に部屋生活を開始。2017年から貴健斗とコンビで初切を担当し部屋の雰囲気を明るくしてきた。",
        "status": "done"
    },
    "d391c27b-b82c-411e-ab6e-ed61ccbf79e6": {  # 天道山
        "birth_date": "2001-12-01", "active_from_basho": "2020-01",
        "high_school": "飛龍高校", "university": None,
        "episodes": "静岡県富士市出身。同郷の先輩・富士の山に誘われて藤島部屋に入門した。初土俵同期に颯富士がいる。2020年3月場所に初めて番付に載ると7戦全勝で序ノ口優勝を達成。故郷の先輩が結んでくれた縁と仲間の存在がコロナ禍でのデビューを力強く支えた。",
        "status": "done"
    },
    "ea07ad63-5ffc-4a17-9875-3a4a37d9dbe4": {  # 天風
        "birth_date": "1991-07-07", "active_from_basho": "2007-03",
        "high_school": None, "university": None,
        "episodes": "香川県琴平町出身。中学時代に柔道で頭角を現した少年を、師匠・尾車親方（元大関・琴風）が愛媛県まで自らスカウトに出向いて口説いた。同期に大翔湖・土佐豊らがいる。尾車部屋解散後は押尾川部屋に移籍し土俵を続ける。親方の情熱的なスカウトが人生を変えた縁の力士。",
        "status": "done"
    },
    "c7ce5615-6b19-4b8c-9a6e-8e99471a0f26": {  # 宇瑠寅
        "birth_date": "1989-05-08", "active_from_basho": "2010-11",
        "high_school": None, "university": None,
        "episodes": "栃木県大田原市出身。大手企業で勤務後、21歳で式秀の「相撲界に入らないか」という言葉に惹かれ入門した異色の遅咲き力士。身長165.8cm・体重62.3kgと大相撲界随一の小兵。四股名「宇瑠寅」はウルトラマンタロウが由来で「3分間全力で土俵を動き回れ」という師匠の願いが込められている。",
        "status": "done"
    },
    "572de4b5-fc1d-4f91-bffa-2e034377398d": {  # 宇良
        "birth_date": "1992-06-22", "active_from_basho": "2016-03",
        "high_school": "大阪偕星学園高校", "university": "関西大学",
        "episodes": "大阪府寝屋川市出身。4歳の時に姉の応援で試合に飛び入りしたのが相撲との出会い。幕内から序二段106枚目まで降格しながら再入幕した史上最低地位からの復帰記録を持つ。木瀬部屋では元同僚・臥牙丸（丸勝）らと共に過ごした。廻しはピンク色のアクロバット相撲で観客を魅了し西小結まで昇進した。",
        "status": "done"
    },
    "ef158cb7-971c-43f9-b0dc-e90e08a14cec": {  # 宮乃風
        "birth_date": "1999-01-30", "active_from_basho": "2021-05",
        "high_school": "沖縄県立北部農林高校", "university": "日本体育大学",
        "episodes": "沖縄県名護市出身。アマチュア相撲の指導者である父の下で5歳から相撲を始め、父の母校・日体大へ進学。大学在学中に中村（元関脇・嘉風）との出会いが大相撲への挑戦心を芽生えさせ教員の道から転換した。父子の絆と恩師の縁が人生の方向を変え2025年9月場所に新十両昇進。",
        "status": "done"
    },
    "5119fc56-f0e8-43bd-a341-ae0761fb51ad": {  # 富士の山
        "birth_date": "2000-07-26", "active_from_basho": "2019-01",
        "high_school": "飛龍高校", "university": None,
        "episodes": "静岡県富士市出身。中学時代に藤島部屋で稽古する機会があり「入るなら藤島部屋」と決意。大学進学の誘いを断り「少しでも早い方がいい」という師匠・18代藤島（元大関・武双山）の言葉に従い高校卒業を待たずに入門。後輩の天道山も自ら誘って同部屋に迎えた。2023年に出身地ゆかりの四股名に改名。",
        "status": "done"
    },
    "28bb2120-bb41-4465-ad07-9f6d5bf0cec7": {  # 富士東 → skip (曖昧さ回避ページ)
        "status": "skip"
    },
    "4c04148a-0313-4f2e-ad6e-3a4a85ac1da6": {  # 将豊竜
        "birth_date": "1996-10-12", "active_from_basho": "2014-09",
        "high_school": "秋田県立平成高校", "university": None,
        "episodes": "秋田県横手市出身。初土俵同期に貴景勝がいる。2020年1月場所から本場所の弓取式を担当する弓取り力士で、身長170cmの小兵ながら「幕下まで昇進した度胸」を花籠（元関脇・太寿山）に買われて選抜された。豪栄道豪太郎に肖って「将太」と改名し再起を図った気骨の人。",
        "status": "done"
    },
    "3d1f31dd-38d8-4b18-b699-8acff20d05fe": {  # 對馬洋
        "birth_date": "1993-06-27", "active_from_basho": "2016-05",
        "high_school": "諫早農業高校", "university": "日本大学",
        "episodes": "長崎県諫早市出身。就職後に大学同期の美ノ海の大相撲入りに刺激を受け自身も角界入りを決意。諫早農業高校・日大OBの元小結・両国が師匠の境川部屋に入門し、新序出世披露では同郷・佐田の富士の化粧廻しを借りた。長崎県出身同士の縁が角界デビューの舞台を飾った。",
        "status": "done"
    },
    "7bbe9622-142a-4f62-947a-4cc2038e4d30": {  # 小原 → skip (ミュージシャン小原礼の記事)
        "status": "skip"
    },
}

def main():
    with open("scripts/data/wiki_episodes_progress.json") as f:
        data = json.load(f)

    now = datetime.datetime.now().isoformat()
    updated = 0
    skipped = 0
    for entry in data:
        uid = entry["id"]
        if uid not in UPDATES:
            continue
        upd = UPDATES[uid]
        if upd.get("status") == "skip":
            entry["status"] = "skip"
            skipped += 1
        else:
            entry["status"] = upd["status"]
            entry["episodes"] = upd.get("episodes")
            entry["birth_date"] = upd.get("birth_date")
            entry["active_from_basho"] = upd.get("active_from_basho")
            entry["high_school"] = upd.get("high_school")
            entry["university"] = upd.get("university")
            entry["fetched_at"] = now
            updated += 1

    with open("scripts/data/wiki_episodes_progress.json", "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Updated: {updated}, Skipped: {skipped}")
    # Summary
    done = sum(1 for e in data if e["status"] == "done")
    skip = sum(1 for e in data if e["status"] == "skip")
    pending = sum(1 for e in data if e["status"] == "pending")
    print(f"Total done: {done}, skip: {skip}, pending: {pending}")

if __name__ == "__main__":
    main()
