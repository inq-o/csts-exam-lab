(() => {
  "use strict";

  const { chapters, questions, topics, examQuestions } = window.CSTS_CONTENT;
  const allQuestions = [...questions, ...examQuestions];
  const questionById = new Map(allQuestions.map(question => [question.id, question]));
  const chapterById = new Map(chapters.map(chapter => [chapter.id, chapter]));
  const topicById = new Map(topics.map(topic => [topic.id, topic]));
  const main = document.getElementById("main");
  const storageKey = "csts-exam-lab-v1";
  const miniMinutes = 26;
  const examMinutes = 90;
  const passScore = 75;
  const groups = {
    overview: [1, 2, 3, 4, 6],
    design: [8, 9, 10],
    process: [11, 12, 13, 14, 15],
  };
  const kinds = ["4지선다", "O/X", "단답형"];
  const groupLabels = { overview: "테스트 개요", design: "테스트 설계 기법", process: "테스트 프로세스" };
  const officialExamples = "https://edu.tta.or.kr/edu/selectBbsNttView.do?bbsNo=1&key=68&nttNo=5814";
  const officialFormat = "https://edu.tta.or.kr/edu/contents.do?key=62";
  const planSteps = [
    {
      id: "design", minutes: 25, title: "커버리지와 입력 설계",
      detail: "문장·결정·조건 커버리지의 분모를 구분하고, 경계 안팎의 값과 상태 전이를 직접 써 보세요.",
      links: [["9장 커버리지", "notes/9"], ["10장 명세 기반 기법", "notes/10"], ["설계 기법 문제", "practice/design"]],
    },
    {
      id: "process", minutes: 20, title: "활동과 산출물 연결",
      detail: "요건 명세서, 준비 보고서, 실행 로그, 현황·종료 보고서가 각각 언제 나오는지 확인하세요.",
      links: [["11장 프로세스 지도", "notes/11"], ["프로세스 문제", "practice/process"]],
    },
    {
      id: "mock", minutes: 26, title: "시간을 재고 20문항 풀기",
      detail: "제출 후 객관식·O/X 결과를 보고, 단답형은 모범 답안과 비교해 채점하세요.",
      links: [["미니 CBT", "practice/mock"]],
    },
    {
      id: "review", minutes: 19, title: "틀린 이유만 다시 보기",
      detail: "오답을 다시 풀고, 헷갈린 용어나 계산 기준은 한 문장으로 설명해 보세요.",
      links: [["오답 노트", "review"], ["2장 테스트 분류", "notes/2"]],
    },
  ];
  let filters = { scope: "all", kind: "all" };
  let endConfirm = false;
  let storageAvailable = true;
  let state = readState();

  function readState() {
    const empty = { attempts: {}, session: null, plan: [] };
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (saved?.version !== 1 || typeof saved.attempts !== "object" || !saved.attempts) return empty;
      const attempts = Object.fromEntries(Object.entries(saved.attempts).filter(([id, result]) =>
        questionById.has(id) && typeof result?.correct === "boolean"));
      const session = saved.session;
      const validSession = session && Array.isArray(session.ids) && session.ids.length &&
        session.ids.every(id => questionById.has(id)) &&
        Number.isInteger(session.index) && session.index >= 0 && session.index < session.ids.length &&
        ["practice", "mock", "exam", "review"].includes(session.mode) &&
        ["active", "results"].includes(session.phase) && session.answers && session.grades && session.shown;
      const plan = Array.isArray(saved.plan) ? planSteps.filter(step => saved.plan.includes(step.id)).map(step => step.id) : [];
      return { attempts, session: validSession ? session : null, plan };
    } catch {
      storageAvailable = false;
      return empty;
    }
  }

  function save() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ version: 1, ...state }));
    } catch {
      storageAvailable = false;
    }
  }

  function escape(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[character]);
  }

  function heading(title, detail, kicker = "") {
    return '<div class="page-heading">' +
      (kicker ? '<p class="eyebrow">' + kicker + '</p>' : "") +
      '<h1 tabindex="-1" data-heading>' + title + '</h1>' +
      (detail ? '<p>' + detail + '</p>' : "") + '</div>';
  }

  function button(text, action, attributes = "", classes = "") {
    return '<button type="button" class="btn ' + classes + '" data-action="' + action + '" ' + attributes + '>' + text + '</button>';
  }

  function writeView(html, focus = false) {
    main.innerHTML = html;
    if (focus) main.querySelector("[data-heading]")?.focus({ preventScroll: true });
  }

  function getCounts() {
    const attempts = questions.filter(question => state.attempts[question.id]);
    const right = attempts.filter(question => state.attempts[question.id].correct).length;
    return { tried: attempts.length, right, wrong: wrongQuestions().length };
  }

  function wrongQuestions() {
    return allQuestions.filter(question => state.attempts[question.id]?.correct === false);
  }

  function route() {
    const [name = "home", value] = location.hash.slice(1).split("/");
    return { name: name || "home", value };
  }

  function openPage(target) {
    if (location.hash !== "#" + target) location.hash = target;
    else render(true);
  }

  function home() {
    const { tried, right, wrong } = getCounts();
    const resume = state.session?.phase === "active";
    const done = state.plan.length;
    const overview = [
      ["개념별 핵심 이론", "개념마다 풀이 예제를 읽고 O/X와 적용 문제로 확인하세요.", '<a class="btn small" href="#notes">개념 목록</a>'],
      ["범위별 문제 풀기", "과목·장·유형별로 고르고 해설을 바로 확인하세요.", '<a class="btn small" href="#practice">연습문제 고르기</a>'],
      ["실전 모의고사", "4지선다 50개, O/X 10개, 단답형 10개를 90분 안에 풉니다.", '<a class="btn small" href="#practice/exam">실전 CBT 준비</a>'],
    ];
    return '<section class="hero"><div><p class="eyebrow">CSTS 일반등급</p>' +
      '<h1 tabindex="-1" data-heading>CSTS 핵심 이론과 문제 풀이</h1>' +
      '<p>일반등급 이론을 ' + topics.length + '개 개념으로 익히고, 예제와 문제로 배운 내용을 확인하세요.</p>' +
      '<div class="row hero-actions"><a class="btn mint" href="#notes">이론 공부 시작</a>' +
      (resume ? '<a class="btn hero-secondary" href="#quiz">이어서 풀기</a>' : '<a class="btn hero-secondary" href="#plan">90분 복습 계획</a>') + '</div></div>' +
      '<div class="hero-panel" aria-label="학습 현황"><div><span>채점한 연습문제</span><strong>' + tried + ' / ' + questions.length + '</strong>' +
      '<progress aria-label="채점한 연습문제" value="' + tried + '" max="' + questions.length + '"></progress></div>' +
      '<div><span>맞힌 문제</span><strong>' + right + '개</strong></div><div><span>다시 볼 오답</span><strong>' + wrong + '개</strong></div>' +
      '<div><span>오늘 계획</span><strong>' + done + ' / ' + planSteps.length + '</strong></div></div></section>' +
      '<div class="section-top"><h2>바로 학습하기</h2><a href="#review">오답 노트</a></div><div class="cards">' +
      overview.map(([title, text, action]) =>
        '<article class="card"><h3>' + title + '</h3><p>' + text + '</p>' + action + '</article>').join("") + '</div>' +
      '<div class="section-top"><h2>시험 전 확인할 세 가지</h2><a href="#notes">전체 장 보기</a></div><div class="cards">' +
      [
        ["9장", "커버리지", "무엇을 분모와 분자에서 세는지 구분합니다.", 9],
        ["10장", "테스트 입력 고르기", "경계 안팎, 값의 조합과 상태 전이를 연습합니다.", 10],
        ["11장", "산출물과 활동 연결", "요건·준비·실행·결함·종료 문서를 구별합니다.", 11],
      ].map(([label, title, text, id]) =>
        '<article class="card"><span class="card-label">' + label + '</span><h3>' + title +
        '</h3><p>' + text + '</p><a class="btn small" href="#notes/' + id + '">핵심 보기</a></article>').join("") +
      '</div><p class="source-note">' + (storageAvailable ? "학습 기록은 이 브라우저에 저장됩니다." : "이 브라우저에서는 학습 기록을 현재 화면에만 보관합니다.") + '</p>';
  }

  function plan() {
    const complete = state.plan.length;
    return '<div class="standalone">' + heading("오늘 공부 계획", "시험 전 90분 복습 순서입니다. 끝낸 항목을 체크해 두세요.") +
      '<div class="panel"><div class="row between"><h2>학습 진도</h2><strong id="plan-progress-label" role="status">' + complete + ' / ' + planSteps.length + ' 완료</strong></div>' +
      '<progress class="spaced" id="plan-progress" aria-label="오늘 학습 진도" value="' + complete + '" max="' + planSteps.length + '"></progress></div>' +
      '<ol class="plan-list">' + planSteps.map(step =>
        '<li class="panel plan-step"><label class="plan-label"><input type="checkbox" data-plan="' + step.id + '"' +
        (state.plan.includes(step.id) ? " checked" : "") + '><span>' + step.title + '</span></label><span class="tag">' + step.minutes + '분</span>' +
        '<p class="subtext">' + step.detail + '</p><div class="row">' + step.links.map(([text, route]) =>
          '<a class="btn small" href="#' + route + '">' + text + '</a>').join("") + '</div></li>').join("") + '</ol>' +
      '<p class="source-note"><a href="#practice/exam">시간을 따로 확보했다면 실전 모의고사 70문항에 도전하세요.</a></p></div>';
  }

  function topicCards(items) {
    return '<ul class="topic-grid">' + items.map(topic =>
      '<li><a class="topic-card" href="#topic/' + topic.id + '"><strong>' + escape(topic.title) +
      '</strong><span>' + escape(topic.teaser) + '</span></a></li>').join("") + '</ul>';
  }

  function catalog() {
    return heading("핵심 이론", "과목별 개념을 골라 예제를 읽고 확인 문제를 풀어 보세요.") +
      '<nav class="row catalog-nav" aria-label="과목 바로 가기">' + Object.keys(groups).map(group =>
        button(groupLabels[group], "catalog-jump", 'data-group="' + group + '"', "small")).join("") + '</nav>' +
      Object.entries(groups).map(([group, ids]) => '<section class="catalog-group" id="catalog-' + group + '">' +
        '<h2 tabindex="-1">' + groupLabels[group] + '</h2>' +
        ids.map(id => {
          const chapter = chapterById.get(id);
          return '<section class="panel catalog-chapter"><div class="row between"><h3><span>' + id +
            '장</span> ' + escape(chapter.title) + '</h3><a href="#notes/' + id + '">이 장 전체 정리</a></div>' +
            topicCards(topics.filter(topic => topic.chapter === id)) + '</section>';
        }).join("") + '</section>').join("");
  }

  function inlineCheck(check) {
    return '<section class="inline-check" aria-labelledby="inline-check-heading"><h2 id="inline-check-heading">바로 확인 O/X</h2><p>' + check.prompt + '</p>' +
      '<div class="row">' + check.options.map((option, index) => button(option, "inline-check",
        'data-id="' + check.id + '" data-choice="' + index + '" aria-pressed="false"')).join("") +
      '</div><div id="inline-feedback" role="status"></div></section>';
  }

  function notes(value) {
    const chapter = chapterById.get(Number(value));
    if (!chapter) return catalog();
    const guide = window.CSTS_GUIDE[chapter.id];
    const check = questions.find(question => question.chapter === chapter.id && question.kind === "O/X");
    const rail = '<aside class="panel chapter-nav" aria-label="장 목록">' + Object.entries(groups).map(([group, ids]) =>
      '<section class="chapter-group"><h2 class="note-rail-title">' + groupLabels[group] + '</h2><div class="chapter-links">' +
      ids.map(id => {
        const item = chapterById.get(id);
        return '<a href="#notes/' + id + '"' + (id === chapter.id ? ' class="active" aria-current="page"' : "") +
          '><span>' + id + '장</span>' + escape(item.title) + '</a>';
      }).join("") + '</div></section>').join("") + '</aside>';
    const chapterPicker = '<label class="reader-select">다른 장 열기<select id="reader-chapter">' + Object.entries(groups).map(([group, ids]) =>
      '<optgroup label="' + groupLabels[group] + '">' + ids.map(id => '<option value="' + id + '"' +
        (id === chapter.id ? " selected" : "") + '>' + id + '장 · ' + escape(chapterById.get(id).title) + '</option>').join("") +
      '</optgroup>').join("") + '</select></label>';
    const summary = '<section class="lesson-guide" aria-label="핵심 복습"><h2>한 줄 핵심</h2><p class="lesson-key">' +
      escape(guide.key) + '</p><dl><div><dt>헷갈리기 쉬운 점</dt><dd>' + escape(guide.trap) +
      '</dd></div><div><dt>예제로 보기</dt><dd>' + escape(guide.example) + '</dd></div></dl></section>';
    const sample = guide.sample
      ? '<p class="source-note"><a target="_blank" rel="noopener" href="' + escape(officialExamples) + '">TTA 일반등급 공개 예제</a> · ' +
        escape(guide.sample) + '</p>'
      : "";
    return '<nav class="breadcrumbs" aria-label="현재 위치"><a href="#notes">핵심 이론</a><span>제' + chapter.id +
      '장</span></nav><div class="layout">' + rail + '<article class="panel reader"><header class="reader-head">' +
      chapterPicker + '<p class="eyebrow">제' + chapter.id + '장</p><h1 tabindex="-1" data-heading>' + escape(chapter.title) + '</h1></header>' +
      summary + '<section class="chapter-topics"><h2>개념별 학습</h2>' +
      topicCards(topics.filter(topic => topic.chapter === chapter.id)) + '</section>' + inlineCheck(check) +
      '<div class="row between reader-controls"><h2>상세 이론</h2>' + button("모든 절 펼치기", "toggle-notes", 'aria-expanded="false"', "small") + '</div>' +
      chapter.sections.map(section => '<details><summary>' + escape(section.title) + '</summary><div class="prose">' + section.html + '</div></details>').join("") +
      '<div class="row">' + button("이 장 문제 " + questions.filter(question => question.chapter === chapter.id).length + "개 풀기",
        "chapter", 'data-chapter="' + chapter.id + '"', "primary") +
      '</div>' + sample + '</article></div>';
  }

  function lesson(value) {
    const topic = topicById.get(value);
    if (!topic) return catalog();
    const chapter = chapterById.get(topic.chapter);
    const [check, exercise] = topic.questions.map(id => questionById.get(id));
    const index = topics.indexOf(topic);
    const related = topic.refs.map(ref => chapter.sections[ref - 1]);
    const adjacent = (item, label) => item ? '<a class="topic-card" href="#topic/' + item.id + '"><span>' + label +
      '</span><strong>' + escape(item.title) + '</strong></a>' : '<a class="topic-card" href="#notes"><strong>전체 개념 목록</strong></a>';
    return '<nav class="breadcrumbs" aria-label="현재 위치"><a href="#notes">핵심 이론</a><a href="#notes/' + chapter.id +
      '">' + chapter.id + '장 · ' + escape(chapter.title) + '</a></nav><header class="lesson-header">' +
      heading(escape(topic.title), escape(topic.teaser)) + '</header>' +
      '<div class="topic-layout"><div><article class="panel prose lesson-body" aria-label="개념과 풀이 예제">' + topic.html +
      '<footer class="lesson-recap"><h2>30초 복습</h2><p>' + topic.recap +
      '</p></footer></article></div><aside class="panel exercises" aria-label="개념 확인 문제">' + inlineCheck(check) +
      '<section class="inline-check"><h2>적용 연습</h2><p>' + exercise.prompt + '</p><details class="exercise-answer">' +
      '<summary>모범 답안 보기</summary><p>' + exercise.explanation + '</p><div class="row spaced">' +
      button("맞았습니다", "topic-self", 'data-id="' + exercise.id + '" data-result="true" aria-pressed="false"', "small") +
      button("틀렸습니다", "topic-self", 'data-id="' + exercise.id + '" data-result="false" aria-pressed="false"', "small") +
      '</div><p class="status-line" id="exercise-result" role="status"></p></details></section>' +
      '<a class="btn small" href="#practice/' + chapter.id + '">이 장 연습문제</a></aside></div>' +
      '<section class="panel reader references"><h2>함께 읽을 장 요약</h2>' +
      related.map(section => '<details><summary>' + escape(section.title) + '</summary><div class="prose">' +
        section.html + '</div></details>').join("") + '</section><nav class="topic-neighbors" aria-label="이전과 다음 개념">' +
      adjacent(topics[index - 1], "이전 개념") + adjacent(topics[index + 1], "다음 개념") + '</nav>';
  }

  function showInlineResult() {
    const options = main.querySelectorAll('[data-action="inline-check"]');
    const id = options[0]?.dataset.id;
    const selected = state.attempts[id]?.choice;
    if (!Number.isInteger(selected)) return;
    const question = questionById.get(id);
    const correct = selected === question.answer;
    options.forEach(option => {
      const chosen = Number(option.dataset.choice) === selected;
      option.setAttribute("aria-pressed", String(chosen));
      option.classList.toggle("primary", chosen);
    });
    const feedback = document.getElementById("inline-feedback");
    feedback.innerHTML = '<div class="feedback ' + (correct ? "correct" : "wrong") + '"><strong>' +
      (correct ? "정답입니다" : "정답은 " + question.options[question.answer] + "입니다") + '</strong><p>' + question.explanation + '</p></div>';
  }

  function showExerciseResult() {
    const controls = main.querySelectorAll('[data-action="topic-self"]');
    const attempt = state.attempts[controls[0]?.dataset.id];
    if (!attempt) return;
    controls.forEach(control => {
      const selected = (control.dataset.result === "true") === attempt.correct;
      control.setAttribute("aria-pressed", String(selected));
      control.classList.toggle("primary", selected);
    });
    document.getElementById("exercise-result").textContent = attempt.correct ? "정답으로 기록했습니다." : "오답 노트에 추가했습니다.";
  }

  function pool() {
    const scope = filters.scope;
    const ids = groups[scope] ?? [Number(scope)];
    return questions.filter(question => (scope === "all" || ids.includes(question.chapter)) &&
      (filters.kind === "all" || filters.kind === question.kind));
  }

  function practice(value) {
    if (value === "exam") return examIntro();
    const mock = value === "mock";
    const resume = state.session?.phase === "active";
    const recent = state.session?.phase === "results";
    const selectOption = (value, label, current) => '<option value="' + escape(value) + '"' +
      (String(value) === current ? " selected" : "") + '>' + escape(label) + '</option>';
    return '<div class="standalone">' + heading("문제 풀이", "일반등급 범위의 자체 연습문제 " + questions.length + "개를 골라 풀 수 있습니다.") +
      (resume ? '<div class="panel row between"><p>이전에 풀던 세션이 있습니다.</p><a class="btn" href="#quiz">이어서 풀기</a></div>' :
        recent ? '<div class="panel row between"><p>마지막 풀이를 확인할 수 있습니다.</p><a class="btn" href="#quiz">최근 결과 보기</a></div>' : "") +
      '<div class="panel' + (resume || recent ? " spaced" : "") + '"><h2>학습 모드</h2><p class="subtext">한 문제씩 풀고 정답과 해설을 바로 확인합니다.</p>' +
      '<div class="form-grid"><label>범위<select id="scope">' +
      selectOption("all", "전체 범위", filters.scope) +
      Object.entries(groupLabels).map(([id, label]) => selectOption(id, label, filters.scope)).join("") +
      chapters.map(item => selectOption(item.id, item.id + "장 · " + item.title, filters.scope)).join("") +
      '</select></label><label>문항 유형<select id="kind">' + selectOption("all", "모든 유형", filters.kind) +
      kinds.map(kind => selectOption(kind, kind, filters.kind)).join("") +
      '</select></label></div><div class="row">' + button(pool().length + "문항 풀기", "practice-start", 'id="practice-start"' +
      (pool().length ? "" : " disabled"), "primary") +
      button("전체 랜덤 퀴즈", "random") +
      '<span class="subtext" id="pool-status" role="status">' + (pool().length ? "" : "이 조건에 해당하는 문항이 없습니다.") + '</span></div></div>' +
      '<div class="panel spaced" id="mock-info"' + (mock ? ' data-mock="true"' : "") + '><h2>미니 CBT</h2>' +
      '<p class="subtext">20문항 · 26분. 제출하면 정답과 해설을 볼 수 있습니다. 단답형은 모범 답안과 비교해 채점하세요.</p>' +
      '<div class="row spaced">' + button("미니 CBT 시작", "mock-start", "", mock ? "primary" : "") + '</div></div>' +
      '<div class="panel spaced"><h2>실전 모의고사</h2><p class="subtext">70문항 · 90분 · 100점 만점</p>' +
      '<a class="btn small spaced" href="#practice/exam">실전 CBT 준비</a></div></div>';
  }

  function examIntro() {
    const session = state.session;
    return '<div class="standalone">' + heading("실전 모의고사", "90분 동안 70문항을 푸는 CSTS 일반등급 자체 모의고사입니다.") +
      '<section class="panel exam-intro"><h2>시험 구성</h2><div class="table-scroll"><table><thead><tr><th scope="col">유형</th>' +
      '<th scope="col">문항 수</th><th scope="col">문항당 배점</th></tr></thead><tbody>' +
      kinds.map(kind => '<tr><th scope="row">' + kind + '</th><td>' +
        examQuestions.filter(question => question.kind === kind).length + '</td><td>' + points(kind) + '점</td></tr>').join("") +
      '</tbody></table></div><p>100점 만점에 ' + passScore + '점이 기준입니다. 시간이 끝나면 제출되며, 이후 단답형은 모범 답안과 비교해 직접 채점합니다.</p>' +
      '<div class="row spaced">' + (session?.mode === "exam" ? '<a class="btn primary" href="#quiz">' +
        (session.phase === "active" ? "이어서 풀기" : "최근 모의고사 결과") + '</a>' : "") +
      button(session?.mode === "exam" ? "처음부터 새로 풀기" : "90분 시험 시작", "exam-start", "", session?.mode === "exam" ? "" : "primary") +
      '<a class="btn" href="#practice">문제 풀이로 돌아가기</a></div>' +
      '<p class="source-note"><a href="' + officialFormat + '" target="_blank" rel="noopener">TTA 일반등급 시험 안내</a></p></section></div>';
  }

  function shuffle(array) {
    const values = [...array];
    for (let index = values.length - 1; index > 0; index--) {
      const other = Math.floor(Math.random() * (index + 1));
      [values[index], values[other]] = [values[other], values[index]];
    }
    return values;
  }

  function mockQuestions() {
    const targets = [13, 3, 4];
    return shuffle(kinds.flatMap((kind, index) =>
      shuffle(questions.filter(question => question.kind === kind && !question.topic)).slice(0, targets[index])));
  }

  function timed(session) {
    return session?.mode === "mock" || session?.mode === "exam";
  }

  function sessionLabel(session) {
    return { exam: "실전 모의고사", mock: "미니 CBT", review: "오답 다시 풀기", practice: "학습 모드" }[session.mode];
  }

  function start(list, mode) {
    if (!list.length) return;
    if (state.session?.phase === "active" && !window.confirm("새로 시작하시겠습니까? 이전에 채점한 학습 기록은 저장됩니다.")) return;
    endConfirm = false;
    const minutes = { mock: miniMinutes, exam: examMinutes }[mode];
    state.session = {
      ids: list.map(question => question.id), mode, phase: "active", index: 0,
      answers: {}, grades: {}, shown: {},
      deadline: minutes ? Date.now() + minutes * 60 * 1000 : null,
    };
    save();
    openPage("quiz");
  }

  function currentQuestion() {
    const session = state.session;
    return questionById.get(session?.ids[session.index]);
  }

  function answerPresent(value) {
    return typeof value === "number" || (typeof value === "string" && value.trim().length > 0);
  }

  function mark(question, outcome, choice) {
    const session = state.session;
    session.grades[question.id] = outcome;
    state.attempts[question.id] = { correct: outcome, at: Date.now(), choice };
  }

  function choiceButtons(question, selection, graded) {
    return question.options.map((option, index) => {
      const chosen = selection === index;
      const style = graded && index === question.answer ? "correct" :
        graded && chosen ? "wrong" : chosen ? "selected" : "";
      const key = question.kind === "O/X" ? option : String(index + 1);
      const extra = question.kind === "O/X" ? "" : "<span>" + option + "</span>";
      return '<button type="button" class="option ' + style + '" data-action="choose" data-choice="' + index +
        '" aria-pressed="' + chosen + '"' + (graded ? " disabled" : "") +
        '><span class="option-key">' + key + '</span>' + extra +
        (graded && index === question.answer ? '<span class="status-ok">정답</span>' : "") + '</button>';
    }).join("");
  }

  function shortMarking(question) {
    return '<div class="row spaced">' +
      button("맞았습니다", "self", 'data-id="' + question.id + '" data-result="true"') +
      button("틀렸습니다", "self", 'data-id="' + question.id + '" data-result="false"') + '</div>';
  }

  function solution(question) {
    const option = question.options[question.answer];
    return question.kind === "4지선다"
      ? "<strong>" + option + "</strong> · " + question.explanation.replace(/^<strong>[①②③④]\.<\/strong>\s*/, "")
      : question.explanation;
  }

  function quiz() {
    const session = state.session;
    if (!session) return heading("문제 풀이", "풀이할 문제를 골라 주세요.") + '<a class="btn primary" href="#practice">문제 고르기</a>';
    if (session.phase === "results") return results();
    const question = currentQuestion();
    const { index, ids } = session;
    const mock = timed(session);
    const answer = session.answers[question.id];
    const grade = session.grades[question.id];
    const graded = typeof grade === "boolean";
    const short = question.kind === "단답형";
    const revealed = !mock && (graded || session.shown?.[question.id]);
    const answeredCount = ids.filter(id => mock ? answerPresent(session.answers[id]) : typeof session.grades[id] === "boolean").length;
    const label = sessionLabel(session);
    const check = mock ? "" : !revealed
      ? button(short ? "모범 답안 보기" : "채점하기", "check", 'id="check"' + (!short && !answerPresent(answer) ? " disabled" : ""), "primary")
      : "";
    const next = index < ids.length - 1 ? button("다음 문제", "next", "", revealed || mock ? "primary" : "") : "";
    const viewAnswer = revealed ? '<div class="feedback ' + (graded ? (grade ? "correct" : "wrong") : "") +
      '" id="feedback" tabindex="-1"><strong>' + (graded ? (grade ? "정답입니다" : "오답으로 기록했습니다") : "모범 답안 · 직접 채점해 주세요") +
      '</strong><p>' + question.explanation + '</p>' + (short && !graded ? shortMarking(question) : "") + '</div>' : "";
    const body = short
      ? '<label class="short-field">내 답안<textarea id="short-answer" maxlength="400" placeholder="답을 적어 보세요."' + (revealed ? " readonly" : "") + '>' + escape(answer) + '</textarea></label>'
      : '<div class="answers" aria-label="선택지">' + choiceButtons(question, answer, revealed) + '</div>';
    const end = mock && endConfirm
      ? '<div class="feedback"><p>지금 제출하시겠습니까? 미응답 ' + (ids.length - answeredCount) + '문항입니다.</p><div class="row spaced">' +
        button("제출하고 채점", "finish", "", "primary") + button("계속 풀기", "cancel-end") + '</div></div>' : "";
    const timer = mock ? '<span class="quiz-clock">남은 시간 <strong class="tabular" id="timer">' +
      timeLabel(session.deadline) + '</strong></span>' : "";
    return '<div class="quiz-layout"><section class="panel"><div class="quiz-top"><div class="row between">' +
      timer +
      '<span class="tag">' + label + '</span><span class="quiz-meta tabular">' + (index + 1) + ' / ' + ids.length + '</span></div>' +
      '<progress value="' + answeredCount + '" max="' + ids.length + '" aria-label="' + (mock ? "응답한 문항 수" : "채점한 문항 수") + '"></progress></div>' +
      '<p class="quiz-meta">' + (session.mode === "exam" ? "" : question.chapter + '장 · ') + question.kind +
      '</p><h1 class="quiz-title" tabindex="-1" data-heading>' + question.prompt + '</h1>' +
      body + viewAnswer + '<div class="row between spaced"><div class="row">' +
      button("이전 문제", "previous", index === 0 ? "disabled" : "") + next +
      '</div><div class="row">' + check + (!mock && index === ids.length - 1 ? button("결과 보기", "finish", "", revealed ? "primary" : "") : "") +
      '</div></div>' + end + '</section><aside class="panel"><h2>문항 이동</h2>' +
      '<p class="quiz-meta" id="answered-summary">' + answeredCount + ' / ' + ids.length + (mock ? ' 응답' : ' 채점') + '</p>' +
      '<div class="dots" aria-label="문항 번호">' + ids.map((id, position) => {
        const filled = mock ? answerPresent(session.answers[id]) : typeof session.grades[id] === "boolean";
        return '<button type="button" class="dot' + (filled ? ' answered' : '') +
          '" data-action="jump" data-index="' + position + '" aria-label="' + (position + 1) + '번' +
          (filled ? ", 완료" : "") + '"' + (position === index ? ' aria-current="step"' : "") + '>' + (position + 1) + '</button>';
      }).join("") + '</div>' +
      '<div class="spaced">' + button(mock ? "시험 제출" : "풀이 결과", mock ? "ask-end" : "finish", "",
        mock && index === ids.length - 1 ? "primary" : "") + '</div></aside></div>';
  }

  function timeLabel(deadline) {
    const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    return Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
  }

  function finish() {
    const session = state.session;
    if (!session || session.phase !== "active") return;
    if (timed(session)) {
      for (const id of session.ids) {
        const question = questionById.get(id);
        const answer = session.answers[id];
        if (question.options.length) mark(question, question.answer === answer, answer);
        else if (!answerPresent(answer)) mark(question, false);
      }
    }
    session.phase = "results";
    endConfirm = false;
    save();
    render(true);
  }

  function points(kind) {
    return kind === "O/X" ? 1 : 1.5;
  }

  function examScore(rows, grades, pending) {
    const scores = kinds.map(kind => rows.filter(question => question.kind === kind && grades[question.id] === true).length * points(kind));
    const total = scores.reduce((sum, score) => sum + score, 0);
    const status = pending ? "단답형 " + pending + "문항을 직접 채점하면 점수가 확정됩니다." :
      (total >= passScore ? "기준 점수 75점 이상" : "기준 점수 75점 미만");
    return '<section class="panel exam-score"><h2>' + (pending ? "현재 점수" : "최종 점수") + '</h2><p><strong>' + total +
      '</strong> / 100점</p><p role="status">' + status + '</p><dl>' + kinds.map((kind, index) =>
        '<div><dt>' + kind + '</dt><dd>' + scores[index] + ' / ' +
        rows.filter(question => question.kind === kind).length * points(kind) + '점</dd></div>').join("") + '</dl></section>';
  }

  function relatedLink(question) {
    return question.topic ? '<a href="#topic/' + question.topic + '">관련 개념 다시 보기</a>' :
      '<a href="#notes/' + question.chapter + '">이 장 요약 보기</a>';
  }

  function results() {
    const session = state.session;
    const isMock = timed(session);
    const rows = session.ids.map(id => questionById.get(id));
    const correct = rows.filter(question => session.grades[question.id] === true).length;
    const wrong = rows.filter(question => session.grades[question.id] === false).length;
    const pending = rows.length - correct - wrong;
    return '<div class="standalone">' + heading("풀이 결과", sessionLabel(session) +
      " · " + rows.length + "문항 중 정답 " + correct + ", 오답 " + wrong + (pending ? ", 미채점 " + pending : "")) +
      (session.mode === "exam" ? examScore(rows, session.grades, pending) : "") +
      '<div class="row"><a class="btn primary" href="#review">오답 노트</a><a class="btn" href="#practice">다른 문제 풀기</a></div><div class="results">' +
      rows.map((question, index) => {
        const saved = session.answers[question.id];
        const grade = session.grades[question.id];
        const show = isMock || typeof grade === "boolean" || session.shown?.[question.id];
        const needsGrade = show && question.kind === "단답형" && typeof grade !== "boolean";
        const answer = typeof saved === "number" ? question.options[saved] : escape(saved);
        const status = grade === true ? "정답" : grade === false ? "오답" : "미채점";
        return '<details class="panel result-row" data-result-row="' + question.id + '"' +
          (needsGrade ? " open" : "") + '><summary>' + (index + 1) + '번 · ' + question.chapter + '장 · <span class="' +
          (grade === true ? "status-ok" : grade === false ? "status-bad" : "") + '">' + status + '</span></summary><p>' +
          question.prompt + '</p><p><strong>내 답안</strong> · ' + (answer || "미응답") + '</p>' +
          (show ? '<p><strong>정답과 해설</strong> · ' + solution(question) + '</p><p>' + relatedLink(question) + '</p>' : "") +
          (needsGrade ? shortMarking(question) : "") + '</details>';
      }).join("") + '</div></div>';
  }

  function review() {
    const wrong = wrongQuestions();
    return '<div class="standalone">' + heading("오답 노트", wrong.length
      ? "최근 풀이에서 틀린 " + wrong.length + "문항입니다." : "아직 기록된 오답이 없습니다.") +
      (wrong.length
        ? '<div class="row">' + button("오답 전부 다시 풀기", "review-start", "", "primary") + '</div><div class="results">' +
          wrong.map(question => '<details class="panel result-row"><summary>' + question.chapter + '장 · ' +
            question.kind + ' · ' + question.prompt + '</summary><p>' + solution(question) +
            '</p>' + relatedLink(question) + '</details>').join("") + '</div>'
        : '<a class="btn primary" href="#practice">문제 풀러 가기</a>') + '</div>';
  }

  function render(focus = false) {
    const { name, value } = route();
    const views = { home, plan, notes, topic: lesson, practice, quiz, review };
    const view = Object.hasOwn(views, name) ? views[name] : home;
    writeView(view(value), focus);
    if (name === "notes" || name === "topic") showInlineResult();
    if (name === "topic") showExerciseResult();
    document.querySelectorAll("[data-nav]").forEach(link => {
      const section = { quiz: "practice", topic: "notes" }[name] ?? name;
      if (link.dataset.nav === section) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    if (name === "practice" && value === "mock") document.getElementById("mock-info")?.scrollIntoView({ block: "nearest" });
  }

  function updateClock() {
    const session = state.session;
    if (!timed(session) || session.phase !== "active") return;
    if (session.deadline <= Date.now()) finish();
    else {
      const timer = document.getElementById("timer");
      if (timer) timer.textContent = timeLabel(session.deadline);
    }
  }

  function move(index) {
    const session = state.session;
    if (!session || session.phase !== "active" || index < 0 || index >= session.ids.length) return;
    session.index = index;
    endConfirm = false;
    save();
    render(true);
    if (main.getBoundingClientRect().top < 0) main.scrollIntoView({ block: "start" });
  }

  function updateMockInputProgress() {
    const session = state.session;
    const count = session.ids.filter(id => answerPresent(session.answers[id])).length;
    const dot = main.querySelector('[data-index="' + session.index + '"]');
    const filled = answerPresent(session.answers[session.ids[session.index]]);
    dot.classList.toggle("answered", filled);
    dot.setAttribute("aria-label", (session.index + 1) + "번" + (filled ? ", 완료" : ""));
    document.getElementById("answered-summary").textContent = count + " / " + session.ids.length + " 응답";
    main.querySelector("progress").value = count;
  }

  main.addEventListener("change", event => {
    if (event.target.id === "reader-chapter") {
      openPage("notes/" + event.target.value);
      return;
    }
    const step = event.target.dataset.plan;
    if (step && planSteps.some(item => item.id === step)) {
      state.plan = event.target.checked ? [...new Set([...state.plan, step])] : state.plan.filter(id => id !== step);
      document.getElementById("plan-progress").value = state.plan.length;
      document.getElementById("plan-progress-label").textContent = state.plan.length + " / " + planSteps.length + " 완료";
      save();
      return;
    }
    if (!["scope", "kind"].includes(event.target.id)) return;
    filters[event.target.id] = event.target.value;
    const count = pool().length;
    const startButton = document.getElementById("practice-start");
    startButton.textContent = count + "문항 풀기";
    startButton.disabled = count === 0;
    document.getElementById("pool-status").textContent = count ? "" : "이 조건에 해당하는 문항이 없습니다.";
  });

  main.addEventListener("input", event => {
    if (event.target.id !== "short-answer" || state.session?.phase !== "active") return;
    state.session.answers[currentQuestion().id] = event.target.value;
    save();
    if (timed(state.session)) updateMockInputProgress();
  });

  main.addEventListener("click", event => {
    const control = event.target.closest("button[data-action]");
    if (!control || control.disabled) return;
    const session = state.session;
    const question = currentQuestion();
    switch (control.dataset.action) {
      case "catalog-jump": {
        const group = document.getElementById("catalog-" + control.dataset.group);
        group.querySelector("h2").focus({ preventScroll: true });
        group.scrollIntoView({ block: "start" });
        break;
      }
      case "inline-check": {
        const id = control.dataset.id;
        const answer = Number(control.dataset.choice);
        state.attempts[id] = { correct: questionById.get(id).answer === answer, at: Date.now(), choice: answer };
        save();
        showInlineResult();
        break;
      }
      case "topic-self": {
        state.attempts[control.dataset.id] = { correct: control.dataset.result === "true", at: Date.now() };
        save();
        showExerciseResult();
        break;
      }
      case "chapter":
        start(questions.filter(item => item.chapter === Number(control.dataset.chapter)), "practice");
        break;
      case "toggle-notes": {
        const open = control.getAttribute("aria-expanded") !== "true";
        main.querySelectorAll(".reader details").forEach(detail => { detail.open = open; });
        control.setAttribute("aria-expanded", String(open));
        control.textContent = open ? "모든 절 접기" : "모든 절 펼치기";
        break;
      }
      case "practice-start": start(pool(), "practice"); break;
      case "random": start(shuffle(questions), "practice"); break;
      case "mock-start": start(mockQuestions(), "mock"); break;
      case "exam-start": start(examQuestions, "exam"); break;
      case "review-start": start(wrongQuestions(), "review"); break;
      case "choose":
        if (session.phase !== "active" || typeof session.grades[question.id] === "boolean") break;
        session.answers[question.id] = Number(control.dataset.choice);
        save();
        render();
        main.querySelector('[data-choice="' + control.dataset.choice + '"]')?.focus({ preventScroll: true });
        break;
      case "check":
        if (question.kind === "단답형") session.shown[question.id] = true;
        else if (answerPresent(session.answers[question.id])) mark(question, session.answers[question.id] === question.answer, session.answers[question.id]);
        save();
        render();
        document.getElementById("feedback")?.focus();
        break;
      case "self": {
        const id = control.dataset.id;
        mark(questionById.get(id), control.dataset.result === "true");
        save();
        render();
        const detail = main.querySelector('[data-result-row="' + id + '"]');
        if (detail) { detail.open = true; detail.querySelector("summary").focus(); }
        else document.getElementById("feedback")?.focus();
        break;
      }
      case "next": move(session.index + 1); break;
      case "previous": move(session.index - 1); break;
      case "jump": move(Number(control.dataset.index)); break;
      case "ask-end": endConfirm = true; render(); main.querySelector('[data-action="finish"]')?.focus(); break;
      case "cancel-end": endConfirm = false; render(); main.querySelector('[data-action="ask-end"]')?.focus(); break;
      case "finish": finish(); break;
    }
  });

  document.querySelector(".skip-link").addEventListener("click", event => {
    event.preventDefault();
    main.focus();
  });

  window.addEventListener("hashchange", () => {
    endConfirm = false;
    const { name, value } = route();
    if (name === "practice" && (Object.hasOwn(groups, value) || chapterById.has(Number(value)))) {
      filters = { scope: value, kind: "all" };
    }
    render(true);
    if (value !== "mock") window.scrollTo(0, 0);
  });

  const initialRoute = route();
  if (initialRoute.name === "practice" &&
      (Object.hasOwn(groups, initialRoute.value) || chapterById.has(Number(initialRoute.value)))) {
    filters = { scope: initialRoute.value, kind: "all" };
  }
  updateClock();
  render();
  window.setInterval(updateClock, 250);
})();

