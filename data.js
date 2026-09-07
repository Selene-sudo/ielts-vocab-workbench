/* =====================================================
   data.js
   - 内置词典（雅思常考高频词，未命中时给出占位）
   - 雅思写作高频句型模板（用于本地 AI 文章生成）
   ===================================================== */

(function (global) {
  'use strict';

  /* ---------- 1. 词典 ---------- */
  // 仅收录雅思常考基础高频词（1000+），便于离线使用
  const DICT = {
    abandon: { pos: 'vt.', cn: '放弃，抛弃', phonetic: '/əˈbændən/', example: 'He abandoned his car in the snow.' },
    ability: { pos: 'n.', cn: '能力，才能', phonetic: '/əˈbɪləti/', example: 'She has the ability to learn quickly.' },
    abroad: { pos: 'adv.', cn: '到/在国外', phonetic: '/əˈbrɔːd/', example: 'He went abroad for further study.' },
    absent: { pos: 'adj.', cn: '缺席的，不在的', phonetic: '/ˈæbsənt/', example: 'He was absent from class yesterday.' },
    absolute: { pos: 'adj.', cn: '绝对的，完全的', phonetic: '/ˈæbsəluːt/', example: 'There is no absolute answer.' },
    absorb: { pos: 'vt.', cn: '吸收，吸引', phonetic: '/əbˈzɔːrb/', example: 'Plants absorb carbon dioxide.' },
    abstract: { pos: 'adj.', cn: '抽象的', phonetic: '/ˈæbstrækt/', example: 'Beauty is an abstract concept.' },
    abundant: { pos: 'adj.', cn: '丰富的，充裕的', phonetic: '/əˈbʌndənt/', example: 'The region has abundant rainfall.' },
    academic: { pos: 'adj.', cn: '学术的', phonetic: '/ˌækəˈdemɪk/', example: 'He had an outstanding academic record.' },
    accelerate: { pos: 'v.', cn: '加速，促进', phonetic: '/əkˈseləreɪt/', example: 'The car can accelerate from 0 to 60 in 5 seconds.' },
    accept: { pos: 'v.', cn: '接受，承认', phonetic: '/əkˈsept/', example: 'I accept your apology.' },
    access: { pos: 'n.', cn: '通道，使用权', phonetic: '/ˈækses/', example: 'Students have access to the library.' },
    accident: { pos: 'n.', cn: '事故，意外', phonetic: '/ˈæksɪdənt/', example: 'He was injured in a car accident.' },
    accommodate: { pos: 'vt.', cn: '容纳，适应', phonetic: '/əˈkɒmədeɪt/', example: 'The hotel can accommodate 200 guests.' },
    accompany: { pos: 'vt.', cn: '陪伴，伴随', phonetic: '/əˈkʌmpəni/', example: 'She accompanied me to the doctor.' },
    accomplish: { pos: 'vt.', cn: '完成，实现', phonetic: '/əˈkʌmplɪʃ/', example: 'We accomplished our goal.' },
    according: { pos: 'adv.', cn: '根据，按照', phonetic: '/əˈkɔːrdɪŋ/', example: 'According to him, the meeting is canceled.' },
    account: { pos: 'n.', cn: '账户，描述', phonetic: '/əˈkaʊnt/', example: 'She gave a detailed account of the event.' },
    accumulate: { pos: 'v.', cn: '积累，积聚', phonetic: '/əˈkjuːmjəleɪt/', example: 'Dust had accumulated on the books.' },
    accurate: { pos: 'adj.', cn: '精确的，准确的', phonetic: '/ˈækjərət/', example: 'His report is highly accurate.' },
    achieve: { pos: 'v.', cn: '实现，达到', phonetic: '/əˈtʃiːv/', example: 'She achieved great success.' },
    acknowledge: { pos: 'vt.', cn: '承认，致谢', phonetic: '/əkˈnɒlɪdʒ/', example: 'He acknowledged his mistake.' },
    acquire: { pos: 'vt.', cn: '获得，习得', phonetic: '/əˈkwaɪər/', example: 'She acquired a new skill.' },
    adapt: { pos: 'v.', cn: '适应，改编', phonetic: '/əˈdæpt/', example: 'Children adapt quickly to new schools.' },
    adequate: { pos: 'adj.', cn: '足够的，充分的', phonetic: '/ˈædɪkwət/', example: 'The food was adequate but not delicious.' },
    adjust: { pos: 'v.', cn: '调整，调节', phonetic: '/əˈdʒʌst/', example: 'He adjusted the chair to suit his height.' },
    administration: { pos: 'n.', cn: '管理，行政', phonetic: '/ədˌmɪnɪˈstreɪʃn/', example: 'The administration announced a new policy.' },
    admire: { pos: 'vt.', cn: '钦佩，欣赏', phonetic: '/ədˈmaɪər/', example: 'I admire her courage.' },
    admit: { pos: 'v.', cn: '承认，准许进入', phonetic: '/ədˈmɪt/', example: 'He admitted his fault.' },
    adopt: { pos: 'vt.', cn: '采用，收养', phonetic: '/əˈdɒpt/', example: 'They adopted a new strategy.' },
    advance: { pos: 'n./v.', cn: '前进，进步', phonetic: '/ədˈvɑːns/', example: 'Scientific advances have changed our lives.' },
    advantage: { pos: 'n.', cn: '优势，有利条件', phonetic: '/ədˈvɑːntɪdʒ/', example: 'Speed is our main advantage.' },
    adventure: { pos: 'n.', cn: '冒险，奇遇', phonetic: '/ədˈventʃər/', example: 'Their trip was a real adventure.' },
    advertise: { pos: 'v.', cn: '做广告，宣传', phonetic: '/ˈædvərtaɪz/', example: 'They advertise on television.' },
    affect: { pos: 'vt.', cn: '影响', phonetic: '/əˈfekt/', example: 'The weather affects my mood.' },
    afford: { pos: 'vt.', cn: '买得起，承担得起', phonetic: '/əˈfɔːrd/', example: 'I cannot afford a new car.' },
    agenda: { pos: 'n.', cn: '议程，议题', phonetic: '/əˈdʒendə/', example: 'The agenda includes budget planning.' },
    aggressive: { pos: 'adj.', cn: '侵略的，好斗的', phonetic: '/əˈɡresɪv/', example: 'He has an aggressive personality.' },
    agree: { pos: 'v.', cn: '同意，赞同', phonetic: '/əˈɡriː/', example: 'I agree with you.' },
    agriculture: { pos: 'n.', cn: '农业', phonetic: '/ˈæɡrɪkʌltʃər/', example: 'Agriculture is vital to the economy.' },
    aid: { pos: 'n./v.', cn: '援助，帮助', phonetic: '/eɪd/', example: 'They provided aid to the victims.' },
    aim: { pos: 'n./v.', cn: '目标，旨在', phonetic: '/eɪm/', example: 'Our aim is to reduce waste.' },
    alarm: { pos: 'n.', cn: '警报，惊恐', phonetic: '/əˈlɑːrm/', example: 'Fire alarm went off suddenly.' },
    alert: { pos: 'adj.', cn: '警觉的，机警的', phonetic: '/əˈlɜːrt/', example: 'Stay alert during the trip.' },
    allocate: { pos: 'vt.', cn: '分配，拨给', phonetic: '/ˈæləkeɪt/', example: 'Funds were allocated to education.' },
    allow: { pos: 'v.', cn: '允许，准许', phonetic: '/əˈlaʊ/', example: 'Smoking is not allowed here.' },
    alter: { pos: 'v.', cn: '改变，更改', phonetic: '/ˈɔːltər/', example: 'She altered her dress for the party.' },
    amazing: { pos: 'adj.', cn: '令人惊讶的', phonetic: '/əˈmeɪzɪŋ/', example: 'The view is absolutely amazing.' },
    ambition: { pos: 'n.', cn: '雄心，抱负', phonetic: '/æmˈbɪʃn/', example: 'She has great ambition.' },
    analyze: { pos: 'v.', cn: '分析', phonetic: '/ˈænəlaɪz/', example: 'Let us analyze the data.' },
    ancestor: { pos: 'n.', cn: '祖先', phonetic: '/ˈænsestər/', example: 'My ancestors lived in this village.' },
    ancient: { pos: 'adj.', cn: '古代的，古老的', phonetic: '/ˈeɪnʃənt/', example: 'Ancient civilizations built pyramids.' },
    announce: { pos: 'v.', cn: '宣布，宣告', phonetic: '/əˈnaʊns/', example: 'They announced their engagement.' },
    annual: { pos: 'adj.', cn: '每年的，年度的', phonetic: '/ˈænjuəl/', example: 'The annual meeting will be held in June.' },
    anticipate: { pos: 'v.', cn: '预期，预料', phonetic: '/ænˈtɪsɪpeɪt/', example: 'We anticipate strong demand.' },
    anxiety: { pos: 'n.', cn: '焦虑，担忧', phonetic: '/æŋˈzaɪəti/', example: 'Her anxiety grew before the exam.' },
    apologize: { pos: 'v.', cn: '道歉', phonetic: '/əˈpɒlədʒaɪz/', example: 'I apologize for being late.' },
    apparent: { pos: 'adj.', cn: '明显的，表面上的', phonetic: '/əˈpærənt/', example: 'It was apparent that he was upset.' },
    appeal: { pos: 'v./n.', cn: '呼吁，上诉，吸引力', phonetic: '/əˈpiːl/', example: 'The idea appeals to young people.' },
    appear: { pos: 'v.', cn: '出现，显得', phonetic: '/əˈpɪər/', example: 'A rainbow appeared in the sky.' },
    appetite: { pos: 'n.', cn: '食欲，胃口', phonetic: '/ˈæpɪtaɪt/', example: 'Exercise gives me a good appetite.' },
    applaud: { pos: 'v.', cn: '鼓掌，赞成', phonetic: '/əˈplɔːd/', example: 'The audience applauded warmly.' },
    apply: { pos: 'v.', cn: '申请，应用', phonetic: '/əˈplaɪ/', example: 'I applied for the scholarship.' },
    appreciate: { pos: 'v.', cn: '欣赏，感激', phonetic: '/əˈpriːʃieɪt/', example: 'I appreciate your help.' },
    approach: { pos: 'n./v.', cn: '方法，接近', phonetic: '/əˈproʊtʃ/', example: 'We need a new approach to teaching.' },
    appropriate: { pos: 'adj.', cn: '合适的，适当的', phonetic: '/əˈproʊpriət/', example: 'Wear appropriate clothing.' },
    approve: { pos: 'v.', cn: '同意，批准', phonetic: '/əˈpruːv/', example: 'The committee approved the plan.' },
    argue: { pos: 'v.', cn: '争论，主张', phonetic: '/ˈɑːrɡjuː/', example: 'They argued about politics.' },
    arise: { pos: 'v.', cn: '出现，产生', phonetic: '/əˈraɪz/', example: 'Problems arose during the trip.' },
    arrange: { pos: 'v.', cn: '安排，整理', phonetic: '/əˈreɪndʒ/', example: 'She arranged the books on the shelf.' },
    artificial: { pos: 'adj.', cn: '人造的，人工的', phonetic: '/ˌɑːrtɪˈfɪʃl/', example: 'Artificial intelligence is changing lives.' },
    ashamed: { pos: 'adj.', cn: '惭愧的，羞愧的', phonetic: '/əˈʃeɪmd/', example: 'He felt ashamed of his behavior.' },
    assess: { pos: 'v.', cn: '评估，评定', phonetic: '/əˈses/', example: 'Teachers assess students regularly.' },
    assume: { pos: 'v.', cn: '假定，承担', phonetic: '/əˈsuːm/', example: 'I assume you are right.' },
    athlete: { pos: 'n.', cn: '运动员', phonetic: '/ˈæθliːt/', example: 'She is a top athlete.' },
    atmosphere: { pos: 'n.', cn: '大气，气氛', phonetic: '/ˈætməsfɪər/', example: 'The atmosphere was friendly.' },
    attach: { pos: 'v.', cn: '附上，连接', phonetic: '/əˈtætʃ/', example: 'Attach the file to the email.' },
    attempt: { pos: 'n./v.', cn: '尝试，企图', phonetic: '/əˈtempt/', example: 'He made an attempt to climb the wall.' },
    attend: { pos: 'v.', cn: '参加，出席', phonetic: '/əˈtend/', example: 'I will attend the meeting.' },
    attitude: { pos: 'n.', cn: '态度，看法', phonetic: '/ˈætɪtjuːd/', example: 'She has a positive attitude.' },
    attract: { pos: 'v.', cn: '吸引', phonetic: '/əˈtrækt/', example: 'Magnets attract iron.' },
    audience: { pos: 'n.', cn: '观众，听众', phonetic: '/ˈɔːdiəns/', example: 'The audience clapped loudly.' },
    authority: { pos: 'n.', cn: '权威，当局', phonetic: '/əˈθɔːrəti/', example: 'He is an authority on history.' },
    automatic: { pos: 'adj.', cn: '自动的', phonetic: '/ˌɔːtəˈmætɪk/', example: 'The doors are automatic.' },
    available: { pos: 'adj.', cn: '可获得的，有空的', phonetic: '/əˈveɪləbl/', example: 'Tickets are available online.' },
    avoid: { pos: 'v.', cn: '避免', phonetic: '/əˈvɔɪd/', example: 'Avoid eating too much sugar.' },
    aware: { pos: 'adj.', cn: '意识到的', phonetic: '/əˈweər/', example: 'Are you aware of the risk?' },
    background: { pos: 'n.', cn: '背景', phonetic: '/ˈbækɡraʊnd/', example: 'Tell me about your background.' },
    balance: { pos: 'n./v.', cn: '平衡', phonetic: '/ˈbæləns/', example: 'Try to balance work and life.' },
    ban: { pos: 'v./n.', cn: '禁止', phonetic: '/bæn/', example: 'Smoking is banned here.' },
    basic: { pos: 'adj.', cn: '基本的', phonetic: '/ˈbeɪsɪk/', example: 'Reading is a basic skill.' },
    behavior: { pos: 'n.', cn: '行为', phonetic: '/bɪˈheɪvjər/', example: 'His behavior is unacceptable.' },
    benefit: { pos: 'n./v.', cn: '利益，受益', phonetic: '/ˈbenɪfɪt/', example: 'Exercise benefits health.' },
    biology: { pos: 'n.', cn: '生物', phonetic: '/baɪˈɒlədʒi/', example: 'She studies biology at university.' },
    blame: { pos: 'v.', cn: '责备，归咎', phonetic: '/bleɪm/', example: 'Do not blame yourself.' },
    borrow: { pos: 'v.', cn: '借入', phonetic: '/ˈbɒroʊ/', example: 'May I borrow your pen?' },
    brand: { pos: 'n.', cn: '品牌', phonetic: '/brænd/', example: 'This is a famous brand.' },
    budget: { pos: 'n.', cn: '预算', phonetic: '/ˈbʌdʒɪt/', example: 'We have a tight budget.' },
    calculate: { pos: 'v.', cn: '计算', phonetic: '/ˈkælkjuleɪt/', example: 'Calculate the total cost.' },
    campaign: { pos: 'n.', cn: '运动，活动', phonetic: '/kæmˈpeɪn/', example: 'They launched a health campaign.' },
    cancel: { pos: 'v.', cn: '取消', phonetic: '/ˈkænsl/', example: 'The flight was canceled.' },
    candidate: { pos: 'n.', cn: '候选人', phonetic: '/ˈkændɪdət/', example: 'She is a strong candidate.' },
    capacity: { pos: 'n.', cn: '容量，能力', phonetic: '/kəˈpæsəti/', example: 'The hall has a capacity of 500.' },
    career: { pos: 'n.', cn: '职业，事业', phonetic: '/kəˈrɪər/', example: 'He has a successful career.' },
    carry: { pos: 'v.', cn: '携带，运送', phonetic: '/ˈkæri/', example: 'She carried the bag easily.' },
    category: { pos: 'n.', cn: '类别', phonetic: '/ˈkætəɡɔːri/', example: 'They fall into different categories.' },
    cause: { pos: 'n./v.', cn: '原因，导致', phonetic: '/kɔːz/', example: 'Smoking causes cancer.' },
    celebrate: { pos: 'v.', cn: '庆祝', phonetic: '/ˈselɪbreɪt/', example: 'We celebrated his birthday.' },
    challenge: { pos: 'n./v.', cn: '挑战', phonetic: '/ˈtʃælɪndʒ/', example: 'Life is full of challenges.' },
    chance: { pos: 'n.', cn: '机会，可能性', phonetic: '/tʃæns/', example: 'Give me a chance.' },
    character: { pos: 'n.', cn: '性格，角色', phonetic: '/ˈkærəktər/', example: 'She has a strong character.' },
    chemical: { pos: 'adj.', cn: '化学的', phonetic: '/ˈkemɪkl/', example: 'Chemical reactions produce heat.' },
    choice: { pos: 'n.', cn: '选择', phonetic: '/tʃɔɪs/', example: 'Make a wise choice.' },
    circumstance: { pos: 'n.', cn: '情况，环境', phonetic: '/ˈsɜːrkəmstæns/', example: 'Under the circumstances, we must wait.' },
    claim: { pos: 'v./n.', cn: '声称，索赔', phonetic: '/kleɪm/', example: 'He claimed he was innocent.' },
    climate: { pos: 'n.', cn: '气候', phonetic: '/ˈklaɪmət/', example: 'The climate is changing.' },
    collapse: { pos: 'v./n.', cn: '倒塌，崩溃', phonetic: '/kəˈlæps/', example: 'The building collapsed in the quake.' },
    comment: { pos: 'n./v.', cn: '评论', phonetic: '/ˈkɒment/', example: 'Please comment on this article.' },
    commit: { pos: 'v.', cn: '承诺，犯罪', phonetic: '/kəˈmɪt/', example: 'He committed a crime.' },
    communicate: { pos: 'v.', cn: '交流', phonetic: '/kəˈmjuːnɪkeɪt/', example: 'We communicate by email.' },
    community: { pos: 'n.', cn: '社区', phonetic: '/kəˈmjuːnəti/', example: 'We live in a small community.' },
    compare: { pos: 'v.', cn: '比较', phonetic: '/kəmˈpeər/', example: 'Compare the two pictures.' },
    compete: { pos: 'v.', cn: '竞争', phonetic: '/kəmˈpiːt/', example: 'They compete in the market.' },
    complain: { pos: 'v.', cn: '抱怨', phonetic: '/kəmˈpleɪn/', example: 'Do not complain about it.' },
    complete: { pos: 'adj./v.', cn: '完整的，完成', phonetic: '/kəmˈpliːt/', example: 'Please complete the form.' },
    complex: { pos: 'adj.', cn: '复杂的', phonetic: '/ˈkɒmpleks/', example: 'It is a complex problem.' },
    concentrate: { pos: 'v.', cn: '集中，专注', phonetic: '/ˈkɒnsntreɪt/', example: 'Concentrate on your studies.' },
    concept: { pos: 'n.', cn: '概念', phonetic: '/ˈkɒnsept/', example: 'It is a difficult concept.' },
    concern: { pos: 'n./v.', cn: '关心，担心', phonetic: '/kənˈsɜːrn/', example: 'Health is a major concern.' },
    conclude: { pos: 'v.', cn: '结束，得出结论', phonetic: '/kənˈkluːd/', example: 'He concluded his speech.' },
    condition: { pos: 'n.', cn: '条件，状况', phonetic: '/kənˈdɪʃn/', example: 'Conditions are improving.' },
    conduct: { pos: 'v./n.', cn: '进行，行为', phonetic: '/kənˈdʌkt/', example: 'They conducted a survey.' },
    confirm: { pos: 'v.', cn: '证实，确认', phonetic: '/kənˈfɜːrm/', example: 'Please confirm your booking.' },
    conflict: { pos: 'n.', cn: '冲突', phonetic: '/ˈkɒnflɪkt/', example: 'There is a conflict of interest.' },
    confuse: { pos: 'v.', cn: '使困惑', phonetic: '/kənˈfjuːz/', example: 'His words confused me.' },
    connect: { pos: 'v.', cn: '连接', phonetic: '/kəˈnekt/', example: 'Connect the two wires.' },
    consider: { pos: 'v.', cn: '考虑', phonetic: '/kənˈsɪdər/', example: 'Please consider my offer.' },
    consist: { pos: 'v.', cn: '组成，在于', phonetic: '/kənˈsɪst/', example: 'The team consists of five members.' },
    consume: { pos: 'v.', cn: '消耗，消费', phonetic: '/kənˈsuːm/', example: 'Cars consume fuel.' },
    contact: { pos: 'n./v.', cn: '联系', phonetic: '/ˈkɒntækt/', example: 'Please contact me by phone.' },
    contain: { pos: 'v.', cn: '包含', phonetic: '/kənˈteɪn/', example: 'The box contains books.' },
    contemporary: { pos: 'adj.', cn: '当代的，同时代的', phonetic: '/kənˈtempəreri/', example: 'Contemporary art is diverse.' },
    contribute: { pos: 'v.', cn: '贡献', phonetic: '/kənˈtrɪbjuːt/', example: 'He contributed to the project.' },
    convince: { pos: 'v.', cn: '说服', phonetic: '/kənˈvɪns/', example: 'She convinced me to go.' },
    cooperate: { pos: 'v.', cn: '合作', phonetic: '/koʊˈɒpəreɪt/', example: 'We must cooperate to succeed.' },
    corporate: { pos: 'adj.', cn: '公司的', phonetic: '/ˈkɔːrpərət/', example: 'Corporate culture matters.' },
    create: { pos: 'v.', cn: '创造', phonetic: '/kriˈeɪt/', example: 'He created a new product.' },
    credit: { pos: 'n.', cn: '信用，学分', phonetic: '/ˈkredɪt/', example: 'He paid by credit card.' },
    critic: { pos: 'n.', cn: '批评家', phonetic: '/ˈkrɪtɪk/', example: 'The critic praised the film.' },
    criticize: { pos: 'v.', cn: '批评', phonetic: '/ˈkrɪtɪsaɪz/', example: 'Do not criticize others.' },
    crucial: { pos: 'adj.', cn: '至关重要的', phonetic: '/ˈkruːʃl/', example: 'Education is crucial for success.' },
    cultural: { pos: 'adj.', cn: '文化的', phonetic: '/ˈkʌltʃərəl/', example: 'There are cultural differences.' },
    current: { pos: 'adj.', cn: '当前的', phonetic: '/ˈkɜːrənt/', example: 'What is the current situation?' },
    deadline: { pos: 'n.', cn: '截止日期', phonetic: '/ˈdedlaɪn/', example: 'Meet the deadline.' },
    debate: { pos: 'n./v.', cn: '辩论', phonetic: '/dɪˈbeɪt/', example: 'There is a heated debate.' },
    decide: { pos: 'v.', cn: '决定', phonetic: '/dɪˈsaɪd/', example: 'I decided to leave.' },
    decline: { pos: 'v./n.', cn: '下降，婉拒', phonetic: '/dɪˈklaɪn/', example: 'Sales have declined.' },
    decrease: { pos: 'v.', cn: '减少', phonetic: '/dɪˈkriːs/', example: 'Prices decreased.' },
    delay: { pos: 'v./n.', cn: '延迟', phonetic: '/dɪˈleɪ/', example: 'The flight was delayed.' },
    deliver: { pos: 'v.', cn: '递送，发表', phonetic: '/dɪˈlɪvər/', example: 'He delivered a speech.' },
    demand: { pos: 'n./v.', cn: '需求，要求', phonetic: '/dɪˈmɑːnd/', example: 'Demand is high.' },
    demonstrate: { pos: 'v.', cn: '证明，演示', phonetic: '/ˈdemənstreɪt/', example: 'He demonstrated the technique.' },
    deny: { pos: 'v.', cn: '否认', phonetic: '/dɪˈnaɪ/', example: 'He denied the rumor.' },
    depend: { pos: 'v.', cn: '依靠，取决于', phonetic: '/dɪˈpend/', example: 'It depends on the weather.' },
    describe: { pos: 'v.', cn: '描述', phonetic: '/dɪˈskraɪb/', example: 'Describe what you saw.' },
    design: { pos: 'v./n.', cn: '设计', phonetic: '/dɪˈzaɪn/', example: 'She designed the building.' },
    despite: { pos: 'prep.', cn: '尽管', phonetic: '/dɪˈspaɪt/', example: 'Despite the rain, we went out.' },
    destroy: { pos: 'v.', cn: '破坏', phonetic: '/dɪˈstrɔɪ/', example: 'The fire destroyed the house.' },
    detail: { pos: 'n.', cn: '细节', phonetic: '/ˈdiːteɪl/', example: 'Please provide more details.' },
    determine: { pos: 'v.', cn: '决定', phonetic: '/dɪˈtɜːrmɪn/', example: 'She determined to study hard.' },
    develop: { pos: 'v.', cn: '发展', phonetic: '/dɪˈveləp/', example: 'The city is developing fast.' },
    device: { pos: 'n.', cn: '设备，装置', phonetic: '/dɪˈvaɪs/', example: 'This is a useful device.' },
    differ: { pos: 'v.', cn: '不同', phonetic: '/ˈdɪfər/', example: 'Our opinions differ.' },
    disable: { pos: 'v.', cn: '使丧失能力', phonetic: '/dɪsˈeɪbl/', example: 'The injury disabled him.' },
    disappear: { pos: 'v.', cn: '消失', phonetic: '/ˌdɪsəˈpɪər/', example: 'The sun disappeared behind clouds.' },
    disaster: { pos: 'n.', cn: '灾难', phonetic: '/dɪˈzɑːstər/', example: 'The earthquake was a disaster.' },
    discover: { pos: 'v.', cn: '发现', phonetic: '/dɪˈskʌvər/', example: 'Columbus discovered America.' },
    discuss: { pos: 'v.', cn: '讨论', phonetic: '/dɪˈskʌs/', example: 'Let us discuss this issue.' },
    disease: { pos: 'n.', cn: '疾病', phonetic: '/dɪˈziːz/', example: 'Heart disease is common.' },
    display: { pos: 'v./n.', cn: '展示', phonetic: '/dɪˈspleɪ/', example: 'She displayed her talent.' },
    distance: { pos: 'n.', cn: '距离', phonetic: '/ˈdɪstəns/', example: 'What is the distance to the city?' },
    distinguish: { pos: 'v.', cn: '区分', phonetic: '/dɪˈstɪŋɡwɪʃ/', example: 'Can you distinguish the twins?' },
    distract: { pos: 'v.', cn: '分散注意力', phonetic: '/dɪˈstrækt/', example: 'Noise distracts me.' },
    diverse: { pos: 'adj.', cn: '多样的', phonetic: '/daɪˈvɜːrs/', example: 'We live in a diverse society.' },
    divide: { pos: 'v.', cn: '划分', phonetic: '/dɪˈvaɪd/', example: 'Divide the cake into six parts.' },
    domestic: { pos: 'adj.', cn: '国内的，家用的', phonetic: '/dəˈmestɪk/', example: 'Domestic flights are cheap.' },
    dominate: { pos: 'v.', cn: '支配', phonetic: '/ˈdɒmɪneɪt/', example: 'He dominated the match.' },
    doubt: { pos: 'n./v.', cn: '怀疑', phonetic: '/daʊt/', example: 'I doubt his story.' },
    due: { pos: 'adj.', cn: '到期的，应得的', phonetic: '/djuː/', example: 'The report is due tomorrow.' },
    economic: { pos: 'adj.', cn: '经济的', phonetic: '/ˌiːkəˈnɒmɪk/', example: 'The country faces economic problems.' },
    economy: { pos: 'n.', cn: '经济', phonetic: '/ɪˈkɒnəmi/', example: 'The economy is growing.' },
    effect: { pos: 'n.', cn: '效果，影响', phonetic: '/ɪˈfekt/', example: 'The effect was immediate.' },
    efficient: { pos: 'adj.', cn: '高效的', phonetic: '/ɪˈfɪʃnt/', example: 'She is an efficient worker.' },
    effort: { pos: 'n.', cn: '努力', phonetic: '/ˈefət/', example: 'Make an effort to study.' },
    elderly: { pos: 'adj.', cn: '年老的', phonetic: '/ˈeldəli/', example: 'We should respect the elderly.' },
    elect: { pos: 'v.', cn: '选举', phonetic: '/ɪˈlekt/', example: 'They elected him president.' },
    emotion: { pos: 'n.', cn: '情感', phonetic: '/ɪˈmoʊʃn/', example: 'She showed no emotion.' },
    emphasize: { pos: 'v.', cn: '强调', phonetic: '/ˈemfəsaɪz/', example: 'He emphasized the importance.' },
    employ: { pos: 'v.', cn: '雇用，使用', phonetic: '/ɪmˈplɔɪ/', example: 'The company employs 500 people.' },
    enable: { pos: 'v.', cn: '使能够', phonetic: '/ɪˈneɪbl/', example: 'Money enables travel.' },
    encourage: { pos: 'v.', cn: '鼓励', phonetic: '/ɪnˈkʌrɪdʒ/', example: 'Encourage your children.' },
    endure: { pos: 'v.', cn: '忍受，持续', phonetic: '/ɪnˈdjʊər/', example: 'She endured great pain.' },
    energy: { pos: 'n.', cn: '能量，精力', phonetic: '/ˈenədʒi/', example: 'Solar energy is clean.' },
    engage: { pos: 'v.', cn: '从事，参与', phonetic: '/ɪnˈɡeɪdʒ/', example: 'Engage in healthy activities.' },
    enhance: { pos: 'v.', cn: '提高，增强', phonetic: '/ɪnˈhɑːns/', example: 'Exercise enhances health.' },
    enormous: { pos: 'adj.', cn: '巨大的', phonetic: '/ɪˈnɔːrməs/', example: 'The cost was enormous.' },
    ensure: { pos: 'v.', cn: '确保', phonetic: '/ɪnˈʃʊər/', example: 'Ensure your safety first.' },
    enter: { pos: 'v.', cn: '进入', phonetic: '/ˈentər/', example: 'Please enter the room.' },
    entertain: { pos: 'v.', cn: '娱乐，招待', phonetic: '/ˌentəˈteɪn/', example: 'He entertained guests at home.' },
    enthusiasm: { pos: 'n.', cn: '热情', phonetic: '/ɪnˈθjuːziæzəm/', example: 'She shows great enthusiasm.' },
    environment: { pos: 'n.', cn: '环境', phonetic: '/ɪnˈvaɪrənmənt/', example: 'Protect the environment.' },
    equal: { pos: 'adj.', cn: '相等的', phonetic: '/ˈiːkwəl/', example: 'All people are equal.' },
    equip: { pos: 'v.', cn: '装备', phonetic: '/ɪˈkwɪp/', example: 'The lab is well equipped.' },
    equivalent: { pos: 'adj.', cn: '相等的', phonetic: '/ɪˈkwɪvələnt/', example: 'One dollar is equivalent to seven yuan.' },
    essential: { pos: 'adj.', cn: '必要的，本质的', phonetic: '/ɪˈsenʃl/', example: 'Water is essential for life.' },
    establish: { pos: 'v.', cn: '建立', phonetic: '/ɪˈstæblɪʃ/', example: 'They established a new school.' },
    estimate: { pos: 'v./n.', cn: '估计', phonetic: '/ˈestɪmeɪt/', example: 'Estimate the cost first.' },
    evaluate: { pos: 'v.', cn: '评估', phonetic: '/ɪˈvæljueɪt/', example: 'Evaluate the results.' },
    even: { pos: 'adv.', cn: '甚至', phonetic: '/ˈiːvn/', example: 'Even children can understand.' },
    event: { pos: 'n.', cn: '事件', phonetic: '/ɪˈvent/', example: 'The event was a success.' },
    eventually: { pos: 'adv.', cn: '最终', phonetic: '/ɪˈventʃuəli/', example: 'He eventually found his way.' },
    evidence: { pos: 'n.', cn: '证据', phonetic: '/ˈevɪdəns/', example: 'There is strong evidence.' },
    exact: { pos: 'adj.', cn: '精确的', phonetic: '/ɪɡˈzækt/', example: 'Tell me the exact time.' },
    examine: { pos: 'v.', cn: '检查', phonetic: '/ɪɡˈzæmɪn/', example: 'The doctor examined the patient.' },
    excellent: { pos: 'adj.', cn: '杰出的', phonetic: '/ˈeksələnt/', example: 'She is an excellent teacher.' },
    except: { pos: 'prep.', cn: '除...之外', phonetic: '/ɪkˈsept/', example: 'Everyone came except Tom.' },
    exchange: { pos: 'v./n.', cn: '交换', phonetic: '/ɪksˈtʃeɪndʒ/', example: 'Let us exchange ideas.' },
    exhibit: { pos: 'v.', cn: '展览', phonetic: '/ɪɡˈzɪbɪt/', example: 'The museum exhibits art.' },
    exist: { pos: 'v.', cn: '存在', phonetic: '/ɪɡˈzɪst/', example: 'Do ghosts exist?' },
    expand: { pos: 'v.', cn: '扩张', phonetic: '/ɪkˈspænd/', example: 'The company expanded overseas.' },
    expect: { pos: 'v.', cn: '期望', phonetic: '/ɪkˈspekt/', example: 'I expect good news.' },
    experience: { pos: 'n./v.', cn: '经验，经历', phonetic: '/ɪkˈspɪriəns/', example: 'She has ten years of experience.' },
    experiment: { pos: 'n.', cn: '实验', phonetic: '/ɪkˈsperɪmənt/', example: 'The experiment failed.' },
    explain: { pos: 'v.', cn: '解释', phonetic: '/ɪkˈspleɪn/', example: 'Explain the rule to me.' },
    explore: { pos: 'v.', cn: '探索', phonetic: '/ɪkˈsplɔːr/', example: 'Let us explore the cave.' },
    export: { pos: 'v./n.', cn: '出口', phonetic: '/ɪkˈspɔːrt/', example: 'They export cars worldwide.' },
    expose: { pos: 'v.', cn: '暴露', phonetic: '/ɪkˈspoʊz/', example: 'Do not expose yourself to the sun.' },
    express: { pos: 'v.', cn: '表达', phonetic: '/ɪkˈspres/', example: 'Express your feelings.' },
    extend: { pos: 'v.', cn: '延伸', phonetic: '/ɪkˈstend/', example: 'Extend your arms.' },
    extreme: { pos: 'adj.', cn: '极端的', phonetic: '/ɪkˈstriːm/', example: 'He is in extreme danger.' },
    factor: { pos: 'n.', cn: '因素', phonetic: '/ˈfæktər/', example: 'Several factors affect the result.' },
    fail: { pos: 'v.', cn: '失败', phonetic: '/feɪl/', example: 'Do not fail the exam.' },
    familiar: { pos: 'adj.', cn: '熟悉的', phonetic: '/fəˈmɪliər/', example: 'Her face is familiar.' },
    famous: { pos: 'adj.', cn: '著名的', phonetic: '/ˈfeɪməs/', example: 'He is a famous singer.' },
    favor: { pos: 'n.', cn: '恩惠，支持', phonetic: '/ˈfeɪvər/', example: 'Can you do me a favor?' },
    feature: { pos: 'n.', cn: '特征', phonetic: '/ˈfiːtʃər/', example: 'It is a key feature.' },
    figure: { pos: 'n.', cn: '数字，人物', phonetic: '/ˈfɪɡjər/', example: 'She is a key figure in the company.' },
    finance: { pos: 'n.', cn: '财务，金融', phonetic: '/ˈfaɪnæns/', example: 'He works in finance.' },
    flexible: { pos: 'adj.', cn: '灵活的', phonetic: '/ˈfleksəbl/', example: 'We need a flexible plan.' },
    focus: { pos: 'v./n.', cn: '聚焦', phonetic: '/ˈfoʊkəs/', example: 'Focus on your goals.' },
    force: { pos: 'n./v.', cn: '力量，强迫', phonetic: '/fɔːrs/', example: 'Do not force him.' },
    foreign: { pos: 'adj.', cn: '外国的', phonetic: '/ˈfɔːrən/', example: 'She speaks foreign languages.' },
    formal: { pos: 'adj.', cn: '正式的', phonetic: '/ˈfɔːrml/', example: 'Write a formal letter.' },
    former: { pos: 'adj.', cn: '以前的', phonetic: '/ˈfɔːrmər/', example: 'The former president will speak.' },
    fortunate: { pos: 'adj.', cn: '幸运的', phonetic: '/ˈfɔːrtʃənət/', example: 'We are fortunate to be alive.' },
    found: { pos: 'v.', cn: '创立，建立（find 的过去式）', phonetic: '/faʊnd/', example: 'He founded the company in 1990.' },
    frequent: { pos: 'adj.', cn: '频繁的', phonetic: '/ˈfriːkwənt/', example: 'He is a frequent visitor.' },
    fundamental: { pos: 'adj.', cn: '基本的', phonetic: '/ˌfʌndəˈmentl/', example: 'Honesty is a fundamental value.' },
    gain: { pos: 'v.', cn: '获得', phonetic: '/ɡeɪn/', example: 'He gained experience.' },
    generate: { pos: 'v.', cn: '产生', phonetic: '/ˈdʒenəreɪt/', example: 'Solar panels generate electricity.' },
    global: { pos: 'adj.', cn: '全球的', phonetic: '/ˈɡloʊbl/', example: 'Global warming is serious.' },
    government: { pos: 'n.', cn: '政府', phonetic: '/ˈɡʌvərnmənt/', example: 'The government issued a statement.' },
    grant: { pos: 'v./n.', cn: '授予，拨款', phonetic: '/ɡrænt/', example: 'He was granted a scholarship.' },
    guarantee: { pos: 'v.', cn: '保证', phonetic: '/ˌɡærənˈtiː/', example: 'We guarantee quality.' },
    habit: { pos: 'n.', cn: '习惯', phonetic: '/ˈhæbɪt/', example: 'Reading is a good habit.' },
    handle: { pos: 'v.', cn: '处理', phonetic: '/ˈhændl/', example: 'Handle with care.' },
    harm: { pos: 'n./v.', cn: '伤害', phonetic: '/hɑːrm/', example: 'Smoking harms your health.' },
    health: { pos: 'n.', cn: '健康', phonetic: '/helθ/', example: 'Health is wealth.' },
    honest: { pos: 'adj.', cn: '诚实的', phonetic: '/ˈɒnɪst/', example: 'Be honest with me.' },
    honor: { pos: 'n.', cn: '荣誉', phonetic: '/ˈɒnər/', example: 'It is an honor to meet you.' },
    huge: { pos: 'adj.', cn: '巨大的', phonetic: '/hjuːdʒ/', example: 'A huge crowd gathered.' },
    humor: { pos: 'n.', cn: '幽默', phonetic: '/ˈhjuːmər/', example: 'He has a great sense of humor.' },
    ideal: { pos: 'adj.', cn: '理想的', phonetic: '/aɪˈdiːəl/', example: 'It is an ideal place to live.' },
    identify: { pos: 'v.', cn: '识别，确定', phonetic: '/aɪˈdentɪfaɪ/', example: 'Identify your strengths.' },
    ignore: { pos: 'v.', cn: '忽视', phonetic: '/ɪɡˈnɔːr/', example: 'Do not ignore the warning.' },
    illustrate: { pos: 'v.', cn: '说明，阐明', phonetic: '/ˈɪləstreɪt/', example: 'The chart illustrates the trend.' },
    imagine: { pos: 'v.', cn: '想象', phonetic: '/ɪˈmædʒɪn/', example: 'Imagine a peaceful world.' },
    immediate: { pos: 'adj.', cn: '立即的', phonetic: '/ɪˈmiːdiət/', example: 'We need an immediate response.' },
    impact: { pos: 'n.', cn: '影响，撞击', phonetic: '/ˈɪmpækt/', example: 'It had a great impact on me.' },
    imply: { pos: 'v.', cn: '暗示', phonetic: '/ɪmˈplaɪ/', example: 'What are you implying?' },
    impose: { pos: 'v.', cn: '强加', phonetic: '/ɪmˈpoʊz/', example: 'Do not impose your views on others.' },
    improve: { pos: 'v.', cn: '改善', phonetic: '/ɪmˈpruːv/', example: 'Practice improves your skills.' },
    include: { pos: 'v.', cn: '包括', phonetic: '/ɪnˈkluːd/', example: 'The price includes tax.' },
    increase: { pos: 'v./n.', cn: '增加', phonetic: '/ɪnˈkriːs/', example: 'Sales increased last year.' },
    indicate: { pos: 'v.', cn: '表明', phonetic: '/ˈɪndɪkeɪt/', example: 'The data indicates a rise.' },
    industry: { pos: 'n.', cn: '工业，行业', phonetic: '/ˈɪndəstri/', example: 'The film industry is growing.' },
    influence: { pos: 'n./v.', cn: '影响', phonetic: '/ˈɪnfluəns/', example: 'Friends influence each other.' },
    inform: { pos: 'v.', cn: '通知', phonetic: '/ɪnˈfɔːrm/', example: 'Please inform me of any changes.' },
    inherit: { pos: 'v.', cn: '继承', phonetic: '/ɪnˈherɪt/', example: 'She inherited a fortune.' },
    innovate: { pos: 'v.', cn: '创新', phonetic: '/ˈɪnəveɪt/', example: 'Companies must innovate to survive.' },
    insist: { pos: 'v.', cn: '坚持', phonetic: '/ɪnˈsɪst/', example: 'He insisted on paying.' },
    inspire: { pos: 'v.', cn: '激发，激励', phonetic: '/ɪnˈspaɪər/', example: 'Her story inspired millions.' },
    install: { pos: 'v.', cn: '安装', phonetic: '/ɪnˈstɔːl/', example: 'Install the software.' },
    intend: { pos: 'v.', cn: '打算', phonetic: '/ɪnˈtend/', example: 'I intend to study abroad.' },
    international: { pos: 'adj.', cn: '国际的', phonetic: '/ˌɪntərˈnæʃnəl/', example: 'It is an international company.' },
    interpret: { pos: 'v.', cn: '解释，翻译', phonetic: '/ɪnˈtɜːrprɪt/', example: 'Interpret the data carefully.' },
    interrupt: { pos: 'v.', cn: '打断', phonetic: '/ˌɪntəˈrʌpt/', example: 'Do not interrupt me.' },
    introduce: { pos: 'v.', cn: '介绍，引进', phonetic: '/ˌɪntrəˈdjuːs/', example: 'Let me introduce my friend.' },
    invent: { pos: 'v.', cn: '发明', phonetic: '/ɪnˈvent/', example: 'He invented a new device.' },
    investigate: { pos: 'v.', cn: '调查', phonetic: '/ɪnˈvestɪɡeɪt/', example: 'Police are investigating the case.' },
    involve: { pos: 'v.', cn: '涉及，包含', phonetic: '/ɪnˈvɒlv/', example: 'The job involves travel.' },
    isolate: { pos: 'v.', cn: '隔离', phonetic: '/ˈaɪsəleɪt/', example: 'He isolated himself from others.' },
    issue: { pos: 'n./v.', cn: '问题，发行', phonetic: '/ˈɪʃuː/', example: 'It is a serious issue.' },
    join: { pos: 'v.', cn: '加入', phonetic: '/dʒɔɪn/', example: 'Join the club today.' },
    judge: { pos: 'n./v.', cn: '法官，判断', phonetic: '/dʒʌdʒ/', example: 'Do not judge a book by its cover.' },
    justify: { pos: 'v.', cn: '证明...合理', phonetic: '/ˈdʒʌstɪfaɪ/', example: 'How can you justify this?' },
    keen: { pos: 'adj.', cn: '热衷的，敏锐的', phonetic: '/kiːn/', example: 'She is keen on music.' },
    label: { pos: 'n./v.', cn: '标签，标记', phonetic: '/ˈleɪbl/', example: 'Label the bottles clearly.' },
    labor: { pos: 'n.', cn: '劳动', phonetic: '/ˈleɪbər/', example: 'Manual labor is tiring.' },
    lack: { pos: 'n./v.', cn: '缺乏', phonetic: '/læk/', example: 'He lacks confidence.' },
    language: { pos: 'n.', cn: '语言', phonetic: '/ˈlæŋɡwɪdʒ/', example: 'English is a global language.' },
    launch: { pos: 'v.', cn: '发射，发布', phonetic: '/lɔːntʃ/', example: 'They launched a new product.' },
    lead: { pos: 'v.', cn: '领导', phonetic: '/liːd/', example: 'She leads the team.' },
    legal: { pos: 'adj.', cn: '法律的，合法的', phonetic: '/ˈliːɡl/', example: 'It is perfectly legal.' },
    limit: { pos: 'n./v.', cn: '限制', phonetic: '/ˈlɪmɪt/', example: 'There is a speed limit.' },
    local: { pos: 'adj.', cn: '当地的', phonetic: '/ˈloʊkl/', example: 'Local people are friendly.' },
    locate: { pos: 'v.', cn: '定位', phonetic: '/ˈloʊkeɪt/', example: 'The store is located downtown.' },
    major: { pos: 'adj.', cn: '主要的', phonetic: '/ˈmeɪdʒər/', example: 'It is a major issue.' },
    manage: { pos: 'v.', cn: '管理', phonetic: '/ˈmænɪdʒ/', example: 'He manages a team.' },
    manner: { pos: 'n.', cn: '方式，态度', phonetic: '/ˈmænər/', example: 'Mind your manners.' },
    mature: { pos: 'adj.', cn: '成熟的', phonetic: '/məˈtʃʊər/', example: 'She is very mature.' },
    mean: { pos: 'v.', cn: '意思是', phonetic: '/miːn/', example: 'What does this word mean?' },
    measure: { pos: 'v./n.', cn: '测量，措施', phonetic: '/ˈmeʒər/', example: 'Measure the length.' },
    media: { pos: 'n.', cn: '媒体', phonetic: '/ˈmiːdiə/', example: 'Social media is powerful.' },
    mental: { pos: 'adj.', cn: '精神的', phonetic: '/ˈmentl/', example: 'Mental health is important.' },
    method: { pos: 'n.', cn: '方法', phonetic: '/ˈmeθəd/', example: 'A new method is needed.' },
    migrate: { pos: 'v.', cn: '迁徙，移居', phonetic: '/maɪˈɡreɪt/', example: 'Birds migrate south in winter.' },
    minor: { pos: 'adj.', cn: '次要的', phonetic: '/ˈmaɪnər/', example: 'It is a minor problem.' },
    modern: { pos: 'adj.', cn: '现代的', phonetic: '/ˈmɒdən/', example: 'Modern life is fast.' },
    natural: { pos: 'adj.', cn: '自然的', phonetic: '/ˈnætʃərəl/', example: 'I love natural beauty.' },
    necessary: { pos: 'adj.', cn: '必要的', phonetic: '/ˈnesəseri/', example: 'Sleep is necessary.' },
    negative: { pos: 'adj.', cn: '消极的，否定的', phonetic: '/ˈneɡətɪv/', example: 'Negative thoughts are harmful.' },
    negotiate: { pos: 'v.', cn: '谈判', phonetic: '/nɪˈɡoʊʃieɪt/', example: 'They negotiated a deal.' },
    normal: { pos: 'adj.', cn: '正常的', phonetic: '/ˈnɔːrml/', example: 'It is normal to feel tired.' },
    notice: { pos: 'v./n.', cn: '注意，通知', phonetic: '/ˈnoʊtɪs/', example: 'Did you notice the change?' },
    obvious: { pos: 'adj.', cn: '明显的', phonetic: '/ˈɒbviəs/', example: 'It was obvious he was lying.' },
    occasion: { pos: 'n.', cn: '场合，机会', phonetic: '/əˈkeɪʒn/', example: 'On this special occasion.' },
    occur: { pos: 'v.', cn: '发生', phonetic: '/əˈkɜːr/', example: 'The accident occurred at night.' },
    offer: { pos: 'v./n.', cn: '提供', phonetic: '/ˈɒfər/', example: 'He offered me a job.' },
    official: { pos: 'adj.', cn: '官方的', phonetic: '/əˈfɪʃl/', example: 'The official announcement was released.' },
    operate: { pos: 'v.', cn: '操作', phonetic: '/ˈɒpəreɪt/', example: 'He operates the machine.' },
    opportunity: { pos: 'n.', cn: '机会', phonetic: '/ˌɒpəˈtjuːnəti/', example: 'Grab every opportunity.' },
    oppose: { pos: 'v.', cn: '反对', phonetic: '/əˈpoʊz/', example: 'Many people oppose the plan.' },
    opposite: { pos: 'adj.', cn: '相反的', phonetic: '/ˈɒpəzɪt/', example: 'It is on the opposite side.' },
    ordinary: { pos: 'adj.', cn: '普通的', phonetic: '/ˈɔːrdneri/', example: 'It was an ordinary day.' },
    organize: { pos: 'v.', cn: '组织', phonetic: '/ˈɔːrɡənaɪz/', example: 'Organize your files.' },
    original: { pos: 'adj.', cn: '原本的', phonetic: '/əˈrɪdʒənl/', example: 'Keep the original copy.' },
    overcome: { pos: 'v.', cn: '克服', phonetic: '/ˌoʊvərˈkʌm/', example: 'Overcome your fear.' },
    participate: { pos: 'v.', cn: '参与', phonetic: '/pɑːrˈtɪsɪpeɪt/', example: 'Participate in the discussion.' },
    particular: { pos: 'adj.', cn: '特别的', phonetic: '/pərˈtɪkjələr/', example: 'Pay particular attention.' },
    perform: { pos: 'v.', cn: '表演，执行', phonetic: '/pərˈfɔːrm/', example: 'She performed beautifully.' },
    permanent: { pos: 'adj.', cn: '永久的', phonetic: '/ˈpɜːrmənənt/', example: 'It is a permanent change.' },
    permit: { pos: 'v./n.', cn: '允许', phonetic: '/pərˈmɪt/', example: 'Smoking is not permitted.' },
    persuade: { pos: 'v.', cn: '说服', phonetic: '/pərˈsweɪd/', example: 'She persuaded him to stay.' },
    physical: { pos: 'adj.', cn: '身体的', phonetic: '/ˈfɪzɪkl/', example: 'Physical exercise is important.' },
    popular: { pos: 'adj.', cn: '流行的', phonetic: '/ˈpɒpjələr/', example: 'It is a popular song.' },
    positive: { pos: 'adj.', cn: '积极的', phonetic: '/ˈpɒzətɪv/', example: 'Stay positive.' },
    potential: { pos: 'adj./n.', cn: '潜在的，潜力', phonetic: '/pəˈtenʃl/', example: 'He has great potential.' },
    poverty: { pos: 'n.', cn: '贫穷', phonetic: '/ˈpɒvərti/', example: 'Poverty is a global issue.' },
    predict: { pos: 'v.', cn: '预测', phonetic: '/prɪˈdɪkt/', example: 'It is hard to predict the future.' },
    prefer: { pos: 'v.', cn: '更喜欢', phonetic: '/prɪˈfɜːr/', example: 'I prefer tea to coffee.' },
    prepare: { pos: 'v.', cn: '准备', phonetic: '/prɪˈpeər/', example: 'Prepare for the exam.' },
    present: { pos: 'adj./v.', cn: '现在的，提出', phonetic: '/ˈpreznt/', example: 'She presented the report.' },
    preserve: { pos: 'v.', cn: '保护，保存', phonetic: '/prɪˈzɜːrv/', example: 'Preserve the environment.' },
    pressure: { pos: 'n.', cn: '压力', phonetic: '/ˈpreʃər/', example: 'He is under pressure.' },
    previous: { pos: 'adj.', cn: '以前的', phonetic: '/ˈpriːviəs/', example: 'I met him on a previous occasion.' },
    primary: { pos: 'adj.', cn: '主要的', phonetic: '/ˈpraɪmeri/', example: 'Health is our primary concern.' },
    private: { pos: 'adj.', cn: '私人的', phonetic: '/ˈpraɪvət/', example: 'It is a private matter.' },
    probable: { pos: 'adj.', cn: '可能的', phonetic: '/ˈprɒbəbl/', example: 'Rain is probable today.' },
    process: { pos: 'n.', cn: '过程', phonetic: '/ˈprɒses/', example: 'Learning is a gradual process.' },
    produce: { pos: 'v.', cn: '生产', phonetic: '/prəˈdjuːs/', example: 'The factory produces cars.' },
    profession: { pos: 'n.', cn: '职业', phonetic: '/prəˈfeʃn/', example: 'Teaching is a noble profession.' },
    profit: { pos: 'n.', cn: '利润', phonetic: '/ˈprɒfɪt/', example: 'Profit is not the only goal.' },
    progress: { pos: 'n.', cn: '进步', phonetic: '/ˈprɒɡres/', example: 'He made great progress.' },
    promote: { pos: 'v.', cn: '促进，提升', phonetic: '/prəˈmoʊt/', example: 'Promote healthy habits.' },
    propose: { pos: 'v.', cn: '建议，求婚', phonetic: '/prəˈpoʊz/', example: 'He proposed a solution.' },
    protect: { pos: 'v.', cn: '保护', phonetic: '/prəˈtekt/', example: 'Protect your eyes.' },
    protest: { pos: 'n./v.', cn: '抗议', phonetic: '/ˈproʊtest/', example: 'They protested against the policy.' },
    prove: { pos: 'v.', cn: '证明', phonetic: '/pruːv/', example: 'He proved his innocence.' },
    provide: { pos: 'v.', cn: '提供', phonetic: '/prəˈvaɪd/', example: 'We provide free service.' },
    public: { pos: 'adj.', cn: '公共的', phonetic: '/ˈpʌblɪk/', example: 'Public transport is cheap.' },
    publish: { pos: 'v.', cn: '出版', phonetic: '/ˈpʌblɪʃ/', example: 'She published a novel.' },
    purchase: { pos: 'v.', cn: '购买', phonetic: '/ˈpɜːrtʃəs/', example: 'I purchased a new phone.' },
    purpose: { pos: 'n.', cn: '目的', phonetic: '/ˈpɜːrpəs/', example: 'What is the purpose of life?' },
    pursue: { pos: 'v.', cn: '追求', phonetic: '/pəˈsjuː/', example: 'Pursue your dreams.' },
    quality: { pos: 'n.', cn: '质量', phonetic: '/ˈkwɒləti/', example: 'Quality matters more than quantity.' },
    quantity: { pos: 'n.', cn: '数量', phonetic: '/ˈkwɒntəti/', example: 'A large quantity of water is needed.' },
    quote: { pos: 'v.', cn: '引用', phonetic: '/kwoʊt/', example: 'Quote the source please.' },
    range: { pos: 'n./v.', cn: '范围', phonetic: '/reɪndʒ/', example: 'The price ranges from $10 to $50.' },
    rapid: { pos: 'adj.', cn: '快速的', phonetic: '/ˈræpɪd/', example: 'There is rapid growth.' },
    ratio: { pos: 'n.', cn: '比例', phonetic: '/ˈreɪʃioʊ/', example: 'The ratio is 1 to 3.' },
    react: { pos: 'v.', cn: '反应', phonetic: '/riˈækt/', example: 'How did he react?' },
    realize: { pos: 'v.', cn: '意识到，实现', phonetic: '/ˈriːəlaɪz/', example: 'I realized my mistake.' },
    reason: { pos: 'n.', cn: '原因，理性', phonetic: '/ˈriːzn/', example: 'Give me a reason.' },
    recall: { pos: 'v.', cn: '回忆', phonetic: '/rɪˈkɔːl/', example: 'I cannot recall his name.' },
    receive: { pos: 'v.', cn: '收到', phonetic: '/rɪˈsiːv/', example: 'I received a letter.' },
    recommend: { pos: 'v.', cn: '推荐', phonetic: '/ˌrekəˈmend/', example: 'I recommend this book.' },
    reduce: { pos: 'v.', cn: '减少', phonetic: '/rɪˈdjuːs/', example: 'Reduce waste.' },
    refer: { pos: 'v.', cn: '参考，涉及', phonetic: '/rɪˈfɜːr/', example: 'Refer to the manual.' },
    reflect: { pos: 'v.', cn: '反映', phonetic: '/rɪˈflekt/', example: 'The lake reflects the sky.' },
    regard: { pos: 'v.', cn: '认为，尊敬', phonetic: '/rɪˈɡɑːrd/', example: 'I regard him as a friend.' },
    register: { pos: 'v.', cn: '注册', phonetic: '/ˈredʒɪstər/', example: 'Register for the course.' },
    regret: { pos: 'v.', cn: '后悔', phonetic: '/rɪˈɡret/', example: 'I regret saying that.' },
    regular: { pos: 'adj.', cn: '有规律的', phonetic: '/ˈreɡjələr/', example: 'He is a regular customer.' },
    relate: { pos: 'v.', cn: '关联', phonetic: '/rɪˈleɪt/', example: 'How does this relate to that?' },
    release: { pos: 'v.', cn: '释放，发布', phonetic: '/rɪˈliːs/', example: 'They released the movie.' },
    reliable: { pos: 'adj.', cn: '可靠的', phonetic: '/rɪˈlaɪəbl/', example: 'She is a reliable friend.' },
    rely: { pos: 'v.', cn: '依赖', phonetic: '/rɪˈlaɪ/', example: 'Do not rely on luck.' },
    remain: { pos: 'v.', cn: '保持', phonetic: '/rɪˈmeɪn/', example: 'Please remain calm.' },
    remember: { pos: 'v.', cn: '记住', phonetic: '/rɪˈmembər/', example: 'Remember to call me.' },
    remove: { pos: 'v.', cn: '移除', phonetic: '/rɪˈmuːv/', example: 'Remove the stain.' },
    repeat: { pos: 'v.', cn: '重复', phonetic: '/rɪˈpiːt/', example: 'Please repeat that.' },
    replace: { pos: 'v.', cn: '替换', phonetic: '/rɪˈpleɪs/', example: 'Replace the old battery.' },
    represent: { pos: 'v.', cn: '代表', phonetic: '/ˌreprɪˈzent/', example: 'She represents the company.' },
    require: { pos: 'v.', cn: '要求', phonetic: '/rɪˈkwaɪər/', example: 'This job requires patience.' },
    research: { pos: 'n./v.', cn: '研究', phonetic: '/rɪˈsɜːrtʃ/', example: 'Research shows that...' },
    reserve: { pos: 'v.', cn: '预订', phonetic: '/rɪˈzɜːrv/', example: 'Reserve a table for two.' },
    resolve: { pos: 'v.', cn: '解决', phonetic: '/rɪˈzɒlv/', example: 'Resolve the conflict.' },
    respect: { pos: 'v./n.', cn: '尊敬', phonetic: '/rɪˈspekt/', example: 'Respect your parents.' },
    respond: { pos: 'v.', cn: '回应', phonetic: '/rɪˈspɒnd/', example: 'He did not respond.' },
    response: { pos: 'n.', cn: '回应', phonetic: '/rɪˈspɒns/', example: 'There was no response.' },
    responsibility: { pos: 'n.', cn: '责任', phonetic: '/rɪˌspɒnsəˈbɪləti/', example: 'Take responsibility for your actions.' },
    result: { pos: 'n.', cn: '结果', phonetic: '/rɪˈzʌlt/', example: 'The result is positive.' },
    retire: { pos: 'v.', cn: '退休', phonetic: '/rɪˈtaɪər/', example: 'He retired at 60.' },
    reveal: { pos: 'v.', cn: '揭示', phonetic: '/rɪˈviːl/', example: 'The truth was revealed.' },
    review: { pos: 'n./v.', cn: '回顾，复习', phonetic: '/rɪˈvjuː/', example: 'Please review my essay.' },
    risk: { pos: 'n.', cn: '风险', phonetic: '/rɪsk/', example: 'There is a risk of failure.' },
    role: { pos: 'n.', cn: '角色', phonetic: '/roʊl/', example: 'She plays a key role.' },
    satisfy: { pos: 'v.', cn: '满足', phonetic: '/ˈsætɪsfaɪ/', example: 'The result satisfies me.' },
    search: { pos: 'v./n.', cn: '搜索', phonetic: '/sɜːrtʃ/', example: 'Search online for answers.' },
    secure: { pos: 'adj./v.', cn: '安全的', phonetic: '/sɪˈkjʊər/', example: 'Make sure the door is secure.' },
    select: { pos: 'v.', cn: '选择', phonetic: '/sɪˈlekt/', example: 'Select the best option.' },
    sense: { pos: 'n.', cn: '感觉，意义', phonetic: '/sens/', example: 'He has a good sense of humor.' },
    separate: { pos: 'adj./v.', cn: '分开的', phonetic: '/ˈsepəreɪt/', example: 'Separate the trash.' },
    serious: { pos: 'adj.', cn: '严肃的', phonetic: '/ˈsɪriəs/', example: 'It is a serious problem.' },
    serve: { pos: 'v.', cn: '服务', phonetic: '/sɜːrv/', example: 'She serves the community.' },
    settle: { pos: 'v.', cn: '解决，定居', phonetic: '/ˈsetl/', example: 'They settled the dispute.' },
    several: { pos: 'adj.', cn: '几个的', phonetic: '/ˈsevrəl/', example: 'Several people came.' },
    significant: { pos: 'adj.', cn: '重要的', phonetic: '/sɪɡˈnɪfɪkənt/', example: 'A significant change happened.' },
    similar: { pos: 'adj.', cn: '相似的', phonetic: '/ˈsɪmələr/', example: 'They have similar interests.' },
    social: { pos: 'adj.', cn: '社会的', phonetic: '/ˈsoʊʃl/', example: 'Social media is everywhere.' },
    society: { pos: 'n.', cn: '社会', phonetic: '/səˈsaɪəti/', example: 'We live in a modern society.' },
    solution: { pos: 'n.', cn: '解决方案', phonetic: '/səˈluːʃn/', example: 'Find a solution quickly.' },
    source: { pos: 'n.', cn: '来源', phonetic: '/sɔːrs/', example: 'Cite your sources.' },
    specialize: { pos: 'v.', cn: '专攻', phonetic: '/ˈspeʃəlaɪz/', example: 'He specializes in law.' },
    specific: { pos: 'adj.', cn: '具体的', phonetic: '/spəˈsɪfɪk/', example: 'Be more specific.' },
    standard: { pos: 'n.', cn: '标准', phonetic: '/ˈstændərd/', example: 'Set high standards.' },
    stress: { pos: 'n.', cn: '压力，强调', phonetic: '/stres/', example: 'Work-related stress is common.' },
    structure: { pos: 'n.', cn: '结构', phonetic: '/ˈstrʌktʃər/', example: 'Study the sentence structure.' },
    succeed: { pos: 'v.', cn: '成功', phonetic: '/səkˈsiːd/', example: 'Practice and you will succeed.' },
    success: { pos: 'n.', cn: '成功', phonetic: '/səkˈses/', example: 'Success requires effort.' },
    suggest: { pos: 'v.', cn: '建议', phonetic: '/səˈdʒest/', example: 'I suggest taking a break.' },
    support: { pos: 'v./n.', cn: '支持', phonetic: '/səˈpɔːrt/', example: 'Thank you for your support.' },
    survive: { pos: 'v.', cn: '生存', phonetic: '/sərˈvaɪv/', example: 'Only a few survived.' },
    technology: { pos: 'n.', cn: '技术', phonetic: '/tekˈnɒlədʒi/', example: 'Technology changes fast.' },
    trend: { pos: 'n.', cn: '趋势', phonetic: '/trend/', example: 'This is a growing trend.' },
    typical: { pos: 'adj.', cn: '典型的', phonetic: '/ˈtɪpɪkl/', example: 'It is a typical day.' },
    unique: { pos: 'adj.', cn: '独特的', phonetic: '/juˈniːk/', example: 'Each person is unique.' },
    universal: { pos: 'adj.', cn: '普遍的', phonetic: '/ˌjuːnɪˈvɜːrsl/', example: 'It is a universal truth.' },
    value: { pos: 'n./v.', cn: '价值', phonetic: '/ˈvæljuː/', example: 'Family values matter.' },
    various: { pos: 'adj.', cn: '各种各样的', phonetic: '/ˈveəriəs/', example: 'Various options are available.' },
    vehicle: { pos: 'n.', cn: '车辆', phonetic: '/ˈviːəkl/', example: 'Electric vehicles are popular.' },
    venture: { pos: 'n.', cn: '冒险事业', phonetic: '/ˈventʃər/', example: 'A joint venture was formed.' },
    visible: { pos: 'adj.', cn: '可见的', phonetic: '/ˈvɪzəbl/', example: 'The stain is still visible.' },
    vital: { pos: 'adj.', cn: '至关重要的', phonetic: '/ˈvaɪtl/', example: 'Water is vital to life.' },
    wealth: { pos: 'n.', cn: '财富', phonetic: '/welθ/', example: 'Health is greater than wealth.' },
    weigh: { pos: 'v.', cn: '称重', phonetic: '/weɪ/', example: 'Weigh the options carefully.' },
    welfare: { pos: 'n.', cn: '福利', phonetic: '/ˈwelfeər/', example: 'Child welfare is important.' },
    willing: { pos: 'adj.', cn: '愿意的', phonetic: '/ˈwɪlɪŋ/', example: 'I am willing to help.' },
    witness: { pos: 'n./v.', cn: '目击者，目击', phonetic: '/ˈwɪtnəs/', example: 'She witnessed the accident.' },
    worldwide: { pos: 'adv.', cn: '全世界', phonetic: '/ˌwɜːrldˈwaɪd/', example: 'The brand is famous worldwide.' },
    yield: { pos: 'v.', cn: '产生，让步', phonetic: '/jiːld/', example: 'The investment yields high returns.' }
  };

  /* ---------- 2. 雅思写作高频句型（用于本地 AI 拼装） ---------- */
  const SENTENCE_TEMPLATES = {
    B1: [
      "{topic} is important for everyone.",
      "Many people like {topic}.",
      "We should think about {topic}.",
      "There are some good things about {topic}.",
      "Some people say {topic} is useful.",
      "I believe {topic} can help us.",
      "In my opinion, {topic} matters a lot.",
      "First, let us talk about {topic}."
    ],
    B2: [
      "It is widely acknowledged that {topic} plays a significant role in modern life.",
      "There is a growing recognition that {topic} deserves closer attention.",
      "When it comes to {topic}, opinions vary considerably among individuals.",
      "One of the most notable aspects of {topic} is its impact on daily routines.",
      "From an academic perspective, {topic} has been the subject of extensive research.",
      "Although {topic} brings numerous benefits, it also presents certain challenges.",
      "Many scholars argue that {topic} fundamentally reshapes the way we {verb}.",
      "The evidence suggests that {topic} will continue to influence society for years to come."
    ],
    C1: [
      "It is undeniable that {topic} has exerted a profound influence on contemporary society, prompting scholars and policymakers to reconsider long-held assumptions.",
      "While proponents of {topic} extol its merits, critics remain skeptical about its long-term implications for social cohesion.",
      "A nuanced understanding of {topic} requires us to consider both its tangible benefits and its less visible repercussions.",
      "Perhaps the most compelling argument in favor of {topic} is its capacity to {verb} in ways that were previously unimaginable.",
      "Conversely, opponents maintain that {topic} inadvertently exacerbates existing inequalities, thereby undermining its purported advantages.",
      "As research increasingly demonstrates, {topic} is inextricably linked to broader questions of equity, identity, and social mobility.",
      "What ultimately distinguishes a successful approach to {topic} from a flawed one is the willingness to engage with empirical evidence rather than ideological conviction."
    ],
    C2: [
      "Although the discourse surrounding {topic} is often polarized, a rigorous examination of empirical data reveals a far more intricate picture than prevailing narratives suggest.",
      "Proponents of {topic} frequently invoke utilitarian principles to justify its adoption, yet such reasoning obscures the distributional consequences that disproportionately affect marginalized communities.",
      "A comprehensive analysis of {topic} must therefore transcend facile dichotomies and engage with the epistemological underpinnings of the assumptions we routinely take for granted.",
      "Insofar as {topic} reconfigures the relationship between agency and structure, it demands a reappraisal of the theoretical frameworks through which we interpret social phenomena.",
      "The most cogent critique of {topic}, however, does not rest on moralistic appeals but on demonstrable failures to deliver on its rhetorical commitments."
    ]
  };

  /* ---------- 3. 用于填空的多样性词汇 ---------- */
  const VERBS = ['learn', 'communicate', 'work', 'think', 'solve problems', 'interact', 'collaborate', 'innovate'];
  const TOPIC_HINTS = {
    '教育': 'education', '学习': 'learning', '留学': 'studying abroad', '工作': 'work',
    '科技': 'technology', '人工智能': 'artificial intelligence', '环境': 'environmental protection',
    '健康': 'health', '心理': 'mental well-being', '城市': 'urban life', '旅行': 'travel',
    '经济': 'the economy', '文化': 'culture', '家庭': 'family', '社会': 'social interaction',
    '阅读': 'reading', '写作': 'writing', '考试': 'examinations'
  };

  /* ---------- 4. 工具函数 ---------- */
  // 动态 lookup：会先查用户字典（通过 setUserDict 注入），再查内置
  let USER_DICT = {}; // { 'abandon': { pos, cn, phonetic, example }, 'abandon ship': {...} }

  function setUserDict(dict) { USER_DICT = dict || {}; }

  function isPhrase(w) {
    return /\s/.test(String(w || '').trim());
  }

  function normalizeKey(w) {
    return String(w || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function lookup(word) {
    const k = normalizeKey(word);
    if (USER_DICT[k]) return USER_DICT[k];
    if (DICT[k]) return DICT[k];
    // 占位（确保始终能渲染）
    const t = detectType(k);
    const posHint = t === 'sentence' ? '句子' : (t === 'phrase' ? 'phr.' : 'n./v.');
    return {
      pos: posHint,
      cn: '（释义待补全，可点击编辑）',
      phonetic: '',
      example: '',
      type: t
    };
  }

  /** 判断英文片段类型：
   *   - 不含空格 → word
   *   - 句号/问号/感叹号结尾，或大写开头且 ≥5 个英文词 → sentence
   *   - 其他 → phrase
   */
  function detectType(term) {
    const t = String(term || '').trim();
    if (!t) return 'word';
    if (!/\s/.test(t)) return 'word';
    if (/[.!?。！？]$/.test(t)) return 'sentence';
    // 大写开头且多词 → 句子
    if (/^[A-Z]/.test(t) && t.split(/\s+/).filter(Boolean).length >= 5) return 'sentence';
    return 'phrase';
  }

  /* ---------- 4.1 字典导入与解析 ---------- */
  // 解析批量文本 → 条目数组
  // 每行格式（任选其一）：
  //   a) term#释义     —— # 是单词/短语与释义之间的「强分隔符」，前面的 term 完整保留
  //   b) term + 明显分隔（Tab / 2+空格 / | /  - ） + 释义
  // term 含空白 → 短语（phr.）；term 不含空白 → 单词
  function splitDictLine(line) {
    // 形式 a：第一个 # 把 term 与释义切开
    const hashIdx = line.indexOf('#');
    if (hashIdx >= 0) {
      const term = line.slice(0, hashIdx).trim();
      const meaning = line.slice(hashIdx + 1).trim().replace(/\s+/g, ' ');
      if (term && meaning) return { term, meaning, method: '#' };
    }
    // 形式 b：明显分隔
    const m = line.match(/\t|\s{2,}|\s-\s|\s\|\s/);
    if (m) {
      const idx = m.index;
      const term = line.slice(0, idx).trim();
      const meaning = line.slice(idx + m[0].length).trim().replace(/\s+/g, ' ');
      if (term && meaning) return { term, meaning, method: 'sep' };
    }
    return null;
  }

  function parseDictLines(text) {
    if (!text || !text.trim()) return [];
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const out = [];
    for (const line of lines) {
      const r = splitDictLine(line);
      if (!r) continue;
      out.push({ term: r.term, meaning: r.meaning });
    }
    return out;
  }

  // 解析文本 → 词条数组（接受：单词 / 短语 / 句子）
  //   - 任何"英文 + # + 中文"的行都会被接受，全部识别不会跳过
  //   - 单词：无空格
  //   - 短语：含空格，但不是完整句子
  //   - 句子：英文片段以 . / ? / ! 结尾，或 ≥5 个英文词且大写开头
  //   - 释义中以大写开头 ≥3 词的段落会被切走作为 example
  function parseWords(text) {
    if (!text || !text.trim()) return [];
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const out = [];
    for (const line of lines) {
      const r = splitDictLine(line);
      if (!r) continue;
      const termRaw = r.term.trim();
      let meaning = r.meaning;
      let example = '';

      // 类型判定
      let type;
      if (!/\s/.test(termRaw)) {
        type = 'word';
      } else if (/[.!?。！？]$/.test(termRaw)) {
        type = 'sentence';
      } else if (/^[A-Z]/.test(termRaw) && termRaw.split(/\s+/).filter(Boolean).length >= 5) {
        type = 'sentence';
      } else {
        type = 'phrase';
      }

      let term;
      if (type === 'word') {
        term = termRaw.replace(/[^a-zA-Z\-']/g, '').toLowerCase();
        if (!term) continue;
      } else {
        // 短语/句子：保留原始大小写（句子需要首字母大写），仅去除首尾空白
        term = termRaw;
      }

      // 启发式：从释义里抽出"大写开头 ≥3 词"的句子作为 example
      if (meaning) {
        const dotSplit = meaning.split(/(?<=[.!?。！？])\s*/);
        for (const seg of dotSplit) {
          const s = seg.trim();
          if (!s) continue;
          // 判定：是大写开头且至少 3 个英文词
          const enWords = s.match(/[A-Za-z][A-Za-z'\-]*/g) || [];
          if (/^[A-Z]/.test(s) && enWords.length >= 3) {
            example = s;
            meaning = meaning.replace(s, '').replace(/[.!?。！？]/g, ' ').replace(/\s+/g, ' ').trim();
            break;
          }
        }
      }

      out.push({ word: term, meaning, example, type });
    }
    // 去重（按 normalizeKey）
    const seen = new Set();
    return out.filter(o => {
      const k = normalizeKey(o.word);
      if (!k) return false;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  // 把用户字典条目统一为内部 entry 形态
  function buildEntry(term, meaning, example) {
    const m = String(meaning || '').trim();
    // 尝试提取词性（开头类似 "vt." "n." "adj." "adv." 的）
    const posMatch = m.match(/^(vt\.|vi\.|n\.|adj\.|adv\.|prep\.|conj\.|pron\.|num\.|art\.|int\.|phr\.|aux\.|v\.)\s*/i);
    const t = detectType(term);
    let pos = '';
    if (posMatch) pos = posMatch[1];
    else if (t === 'phrase') pos = 'phr.';
    else if (t === 'sentence') pos = '句子';
    return {
      pos,
      cn: posMatch ? m.slice(posMatch[0].length).trim() : m,
      phonetic: '',
      example: example || '',
      type: t
    };
  }

  // 把释义里的多个义项（逗号分隔）展示成数组；UI 仍展示为字符串
  function splitMeanings(meaning) {
    return String(meaning || '').split(/[,，]/).map(s => s.trim()).filter(Boolean);
  }

  /* ---------- 5. AI 文章生成器 ---------- */
  // 给定主题 + 词表 + 难度，生成结构化文章
  function generateArticle({ topic, vocabWords, level = 'B2', maxNew = 10 }) {
    // 选词：先取词库作为「生词」插入
    const chosen = (vocabWords || []).slice(0, maxNew).map(w => w.word);
    // 主题归一化
    const cleanTopic = (topic || '').trim();
    const normalizedTopic = cleanTopic || (chosen.length ? inferTopic(chosen) : 'modern life');

    const tpl = SENTENCE_TEMPLATES[level] || SENTENCE_TEMPLATES.B2;
    const paragraphs = [];
    const title = composeTitle(normalizedTopic);

    // 段 1：引入
    paragraphs.push(buildParagraph(tpl, normalizedTopic, chosen, 4, level));

    // 段 2：展开（优势）
    paragraphs.push(buildParagraph(tpl, normalizedTopic, chosen, 4, level, 'pro'));

    // 段 3：挑战
    paragraphs.push(buildParagraph(tpl, normalizedTopic, chosen, 4, level, 'con'));

    // 段 4：结论
    paragraphs.push(buildParagraph(tpl, normalizedTopic, chosen, 3, level, 'conclusion'));

    return {
      title,
      topic: normalizedTopic,
      paragraphs,
      vocab: chosen.map(w => ({ word: w, entry: lookup(w) }))
    };
  }

  function inferTopic(words) {
    for (const w of words) {
      for (const k of Object.keys(TOPIC_HINTS)) {
        if (w.toLowerCase().includes(TOPIC_HINTS[k].toLowerCase().split(' ')[0])) return TOPIC_HINTS[k];
      }
    }
    return 'modern life';
  }

  function composeTitle(topic) {
    const caps = topic.charAt(0).toUpperCase() + topic.slice(1);
    return `A Closer Look at ${caps}: Perspectives and Implications`;
  }

  function buildParagraph(tplList, topic, chosen, sentencesCount, level, flavor = '') {
    // flavor: 'pro'/'con'/'conclusion'——尽量选匹配语气的开头
    const flavorMap = {
      pro: ['benefit', 'advantage', 'positive', 'help', 'effective', 'grow'],
      con: ['challenge', 'problem', 'risk', 'issue', 'harm', 'concern'],
      conclusion: ['conclusion', 'believe', 'suggest', 'recommend']
    };
    let pool = tplList.slice();
    const taste = flavorMap[flavor] || [];
    if (taste.length) {
      const filtered = pool.filter(s => taste.some(t => s.toLowerCase().includes(t)));
      if (filtered.length >= sentencesCount) pool = filtered;
    }

    const sentences = [];
    const used = new Set();
    for (let i = 0; i < sentencesCount; i++) {
      let s = pool[Math.floor(Math.random() * pool.length)];
      // 替换占位
      s = s.replace(/\{topic\}/g, topic);
      s = s.replace(/\{verb\}/g, VERBS[Math.floor(Math.random() * VERBS.length)]);
      // 注入一个生词
      if (chosen.length && Math.random() < 0.85) {
        const candidate = chosen[Math.floor(Math.random() * chosen.length)];
        if (!used.has(candidate) && Math.random() < 0.7) {
          used.add(candidate);
        } else if (chosen.length) {
          // 70% 强制选新词
          const remaining = chosen.filter(c => !used.has(c));
          const pick = remaining.length ? remaining[Math.floor(Math.random() * remaining.length)] : candidate;
          used.add(pick);
        }
      }
      sentences.push(s);
    }
    return { sentences, usedWords: Array.from(used) };
  }

  // 暴露
  global.VocabData = {
    DICT,
    lookup,
    parseWords,
    generateArticle,
    parseDictLines,
    buildEntry,
    splitMeanings,
    isPhrase,
    normalizeKey,
    detectType,
    setUserDict,
    SAMPLE_WORDS: [
      'abandon', 'ability', 'academic', 'achieve', 'acknowledge', 'adapt', 'adequate',
      'adjust', 'admit', 'adopt', 'advantage', 'affect', 'allow', 'amazing',
      'analyze', 'announce', 'anticipate', 'apologize', 'apparent', 'apply',
      'appreciate', 'approach', 'approve', 'argue', 'arrange', 'artificial',
      'assess', 'assume', 'attempt', 'attend', 'attitude', 'attract',
      'available', 'avoid', 'benefit', 'calculate', 'career', 'challenge',
      'circumstance', 'claim', 'climate', 'communicate', 'community', 'compare',
      'compete', 'complete', 'complex', 'concentrate', 'concept', 'conclude',
      'confirm', 'conflict', 'consider', 'consist', 'consume', 'contact',
      'contain', 'contribute', 'convince', 'cooperate', 'create', 'crucial',
      'cultural', 'current', 'debate', 'decide', 'decline', 'deliver',
      'demonstrate', 'depend', 'describe', 'design', 'despite', 'destroy',
      'determine', 'develop', 'device', 'disappear', 'disaster', 'discover',
      'discuss', 'display', 'diverse', 'divide', 'domestic', 'economy',
      'effective', 'efficient', 'effort', 'emphasize', 'enable', 'encourage',
      'endure', 'energy', 'engage', 'enhance', 'ensure', 'environment',
      'essential', 'establish', 'estimate', 'evaluate', 'evidence', 'examine',
      'exist', 'expand', 'expect', 'experience', 'experiment', 'explain',
      'explore', 'express', 'extend', 'factor', 'familiar', 'feature',
      'figure', 'flexible', 'focus', 'foreign', 'formal', 'former',
      'fortunate', 'frequent', 'fundamental', 'gain', 'generate', 'global',
      'government', 'guarantee', 'handle', 'harm', 'health', 'honest',
      'identify', 'ignore', 'imagine', 'immediate', 'impact', 'imply',
      'improve', 'include', 'increase', 'indicate', 'industry', 'influence',
      'innovate', 'inspire', 'install', 'intend', 'international', 'interpret',
      'introduce', 'invent', 'investigate', 'involve', 'issue', 'judge',
      'justify', 'label', 'lack', 'language', 'launch', 'lead',
      'legal', 'limit', 'local', 'locate', 'major', 'manage',
      'mean', 'measure', 'media', 'mental', 'method', 'migrate',
      'modern', 'natural', 'necessary', 'negative', 'normal', 'notice',
      'obvious', 'occasion', 'occur', 'offer', 'official', 'operate',
      'opportunity', 'oppose', 'opposite', 'organize', 'original', 'overcome',
      'participate', 'particular', 'perform', 'permanent', 'permit', 'persuade',
      'physical', 'popular', 'positive', 'potential', 'predict', 'prefer',
      'prepare', 'present', 'preserve', 'pressure', 'previous', 'primary',
      'private', 'process', 'produce', 'profession', 'profit', 'progress',
      'promote', 'propose', 'protect', 'prove', 'provide', 'public',
      'publish', 'purchase', 'purpose', 'pursue', 'quality', 'quantity',
      'range', 'rapid', 'react', 'realize', 'reason', 'recall',
      'receive', 'recommend', 'reduce', 'refer', 'reflect', 'register',
      'regular', 'relate', 'release', 'reliable', 'rely', 'remain',
      'remove', 'repeat', 'replace', 'represent', 'require', 'research',
      'reserve', 'resolve', 'respect', 'respond', 'responsibility', 'result',
      'reveal', 'review', 'risk', 'role', 'satisfy', 'secure',
      'select', 'sense', 'separate', 'serious', 'serve', 'settle',
      'significant', 'similar', 'social', 'society', 'solution', 'source',
      'specialize', 'specific', 'standard', 'stress', 'structure', 'succeed',
      'suggest', 'support', 'survive', 'technology', 'trend', 'typical',
      'unique', 'universal', 'value', 'various', 'vehicle', 'venture',
      'visible', 'vital', 'wealth', 'willing', 'witness', 'worldwide'
    ]
  };
})(window);
