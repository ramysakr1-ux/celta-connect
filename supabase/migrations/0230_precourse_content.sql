-- Real UCLES 2018 Pre-Course Task content + answer key, replacing the
-- placeholder text seeded in migration 0056, plus the schema correction
-- that content exposed: for-claude-code-pre-course-task-screens.md (27 Aug
-- 2026) says the task is done on paper and never submitted -- "not graded,
-- not handed in, your tutor reads it on day one" -- so pre_course_task_
-- responses (a typed-answer-per-section model) was the wrong shape from the
-- start. Replaced with pre_course_task_progress (simple section-done
-- self-report, no text) and pre_course_task_items (the real content to
-- read on screen -- ~50 numbered Cambridge tasks across 5 sections, not
-- one blob per section, which is why this needs its own table).

create table public.pre_course_task_items (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.pre_course_task_sections (id) on delete cascade,
  task_number integer,
  sequence_index smallint not null,
  prompt text not null,
  answer text,
  created_at timestamptz not null default now()
);

create index pre_course_task_items_section_id_idx on public.pre_course_task_items (section_id);

alter table public.pre_course_task_items enable row level security;

create policy "pre_course_task_items: members can read their center's items"
on public.pre_course_task_items for select
to authenticated
using (
  section_id in (select id from public.pre_course_task_sections where center_id = public.current_center_id())
);

create policy "pre_course_task_items: trainer/admin manage their center's items"
on public.pre_course_task_items for all
to authenticated
using (
  (public.is_trainer() or public.is_admin())
  and section_id in (select id from public.pre_course_task_sections where center_id = public.current_center_id())
)
with check (
  (public.is_trainer() or public.is_admin())
  and section_id in (select id from public.pre_course_task_sections where center_id = public.current_center_id())
);

create table public.pre_course_task_progress (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  trainee_id uuid not null references public.profiles (id) on delete cascade,
  section_id uuid not null references public.pre_course_task_sections (id) on delete cascade,
  completed_at timestamptz,
  unique (trainee_id, section_id)
);

create index pre_course_task_progress_course_id_idx on public.pre_course_task_progress (course_id);
create index pre_course_task_progress_trainee_id_idx on public.pre_course_task_progress (trainee_id);

alter table public.pre_course_task_progress enable row level security;

create policy "pre_course_task_progress: trainee manages their own progress"
on public.pre_course_task_progress for all
to authenticated
using (trainee_id = auth.uid())
with check (trainee_id = auth.uid());

create policy "pre_course_task_progress: trainer reads their course's progress"
on public.pre_course_task_progress for select
to authenticated
using (public.is_trainer() and course_id = public.current_course_id());

drop table public.pre_course_task_responses;

-- Real section titles + intro text (was placeholder).
update public.pre_course_task_sections set
  title = $pctxt$Learners and Teachers, and the Teaching and Learning Context$pctxt$,
  prompt = $pctxt$Section 1: Learners and Teachers, and the 
Teaching and Learning Context 

A Teaching and learning contexts 

Types of contexts 

Because English language teaching and learning takes place around the globe, there can be many different 
learning/teaching contexts: 
• one-to-one lessons/lessons in groups 
• monolingual/multilingual groups 
• closed/open groups 
• full-time/part-time courses 
• learners with little or no previous formal education 
• mixed/similar ability groups 
• mixed/same gender groups 
• large/smaller classes 
• day/evening classes 
• teachers with English-speaking/non-English-speaking backgrounds 

Notes on the groups: 

Monolingual The students all speak the same first language, e.g. the students all speak Spanish. 

Multilingual The students all speak different first languages. 

Closed The students usually all come from the same institution and no other learners join their group 
e.g. A group of employees from the same bank study in the same group. 

And we could consider other variables such as jobs, interests, reasons for learning English, and so on. 

It is a good idea to find out about these factors before you teach your first class, as it will have an effect on your 
planning.$pctxt$
where source = 'cambridge' and sequence_index = 1;

update public.pre_course_task_sections set
  title = $pctxt$Language Analysis and Awareness$pctxt$,
  prompt = $pctxt$Section 2: Language Analysis and Awareness 

A Grammar 

Section A of this unit aims to: 
• highlight the value of explicit grammatical knowledge in English language teaching 
• identify different word classes 
• clarify the distinction between lexical and auxiliary verbs 
• highlight different verb forms 
• clarify the construction of different verb phrases 
• illustrate the relationship between grammatical form and meaning. 

Overview 

A lot of negative connotations surround the word ‘grammar’. They are often associated with learning 
experiences in English language or second language classes when we were at primary or high school.$pctxt$
where source = 'cambridge' and sequence_index = 2;

update public.pre_course_task_sections set
  title = $pctxt$Language Skills: Reading, Listening, Speaking and Writing$pctxt$,
  prompt = $pctxt$Section 3: Language Skills: Reading, Listening, 
Speaking and Writing 

A Reading 

Ways of reading 

When we read in our first language, we deploy a variety of reading skills depending on the nature of the text 
that we are reading. This means we do not read a bus timetable in the same way that we read a question in an 
exam we are sitting. When we read a bus timetable, our eyes scan the text in order to find an appropriate 
departure or arrival time, while we are likely to read the exam question in great detail to ensure that we have 
understood and interpreted it correctly.$pctxt$
where source = 'cambridge' and sequence_index = 3;

update public.pre_course_task_sections set
  title = $pctxt$Planning and Resources$pctxt$,
  prompt = $pctxt$Section 4: Planning and Resources 

A Planning and preparation 

Preparation and planning are important parts of a teacher’s role. Lessons are more likely to be effective if the 
teacher has thought through the various aspects of the lesson beforehand. It is also important to create a 
written lesson plan as a guideline for what should happen in a lesson. On the CELTA course you will be asked to 
plan for your teaching in cooperation with other trainees. You will be required to produce a written plan for 
most of the lessons you teach. 

The lesson plan 

Lesson plan formats are varied. Most plans contain some of the points below: 

1. Lesson aims/learning 
outcomes 
 what the learners should be able to do by the end of the 
lesson 
2. Anticipated problems 
and solutions 
 areas you think may cause difficulty for your learners and 
your solutions 
3. Personal aim some area of your teaching you want to improve in this 
lesson 
4. Stage a part of the lesson 
5. Procedure what students/teacher are doing at any particular stage of 
the lesson 
6. Interaction pattern the direction of the communication (teacher to 
students/students to students) 
7. Stage aim the reason for doing this stage of the lesson and how it 
relates to the overall aim of the lesson$pctxt$
where source = 'cambridge' and sequence_index = 4;

update public.pre_course_task_sections set
  title = $pctxt$Developing Teaching Skills and Professionalism$pctxt$,
  prompt = $pctxt$Section 5: Developing Teaching Skills and 
Professionalism 

A Developing Teaching Skills 

In the Teaching Practice sessions on the CELTA course you will be encouraged to develop different teaching 
skills and you will need to demonstrate competence in managing and organising the learning environment. 

Teacher language 

Depending on the group you teach, your learners will have different levels of language skills. At all levels it is 
important to think about your own language use in the classroom. This is because you serve as an example of 
the language they are trying to learn – you provide a language model, so it is important to be accurate. In 
addition, you will need to grade or modify your language so that learners will understand the language you use 
to manage the classroom, mainly in the form of instructions.$pctxt$
where source = 'cambridge' and sequence_index = 5;

-- Real per-task content, one row per Task N, seeded for every center that
-- already has the section 1-5 rows (migration 0056 seeded one set per
-- center via cross join).
insert into public.pre_course_task_items (section_id, task_number, sequence_index, prompt, answer)
select id, 1, 1, $pctxt$1. In what context will you be doing the CELTA course? 

2. Do you know what context you will be teaching in after you finish the course? 

B The learners’ cultural, linguistic and educational backgrounds 

Adult learners 

Teaching adult learners is generally very different from teaching younger learners. Our approach will need to 
take into account the characteristics of adult learners.$pctxt$, null
from public.pre_course_task_sections where source = 'cambridge' and sequence_index = 1;

insert into public.pre_course_task_items (section_id, task_number, sequence_index, prompt, answer)
select id, 2, 2, $pctxt$1. Think about why you decided to teach adults. 

2. Think about what you, as an adult, bring to this learning situation. 

3. Look at your answers to questions 1 and 2 and use these ideas to help you to write down what characterises 
adult learners. 

 
Finding out about learners 

When adult students arrive in a school or college, they are usually given a placement test and then grouped 
roughly according to their language level. In order to teach them successfully, you need to find out about them 
as people and learners.$pctxt$, $pctxt$Adult learners often bring: 
• reasons for learning
• specific goals
• expectations
• successful and unsuccessful past learning experiences
• rich life experiences
• attitudes to learning, the culture and the language
• ideas about the role of the teacher and learner
• certain aptitudes
• developed literacy and thinking skills
• personal characteristics
• self-discipline
• values and beliefs
• an ability to reflect on their learning
• learning styles
• varying levels of confidence and self-esteem
• different levels of motivation
• anxieties
• status or 'face'.$pctxt$
from public.pre_course_task_sections where source = 'cambridge' and sequence_index = 1;

insert into public.pre_course_task_items (section_id, task_number, sequence_index, prompt, answer)
select id, 3, 3, $pctxt$1. What would you want to find out about a group of learners that you had to teach so that you could plan 
your lessons? 

2. How would you find out? 

 
C Motivation 

Motivations for learning English 

Learners are sometimes learning a language for personal reasons or, very occasionally, out of interest or for 
self-growth. However, most learners are learning a language as a means to other ends. As a teacher, you need 
to help learners move towards their goals. 

Extrinsic motivation is motivation from factors outside the classroom, such as the reasons for learning English. 

Learners often learn English: 
• to gain access to employment 
• to be able to study and research in English 
• to be able to pass public exams in an English-speaking country 
• to be able to live in an English-speaking country 
• to socialise with neighbours 
• for career, status and job prospects 
• to involve themselves in their children’s schooling 
• to be able to understand English films, TV and songs 
• to find out more about the people and culture of English-speaking people 
• to be able to read English literature 
• because of pressure from family 
• to gain citizenship 

Adapted from Hedge, T (2000) Teaching and Learning in the Language Classroom, Oxford: Oxford University 
Press pp. 22-23$pctxt$, $pctxt$1. You usually find out about:
• their job or studies
• their language learning experience up till now
- how long
- how often
• what language learning activities they are used to doing
• the level of books they used or the level of the class they studied in, if any
• how much they enjoyed learning English
• the reasons they are learning English
• any specific goals
• particular language or skills that they need (See Unit 3 on Skills) 
• the length of time they are going to stay in the school/college 
• what they expect of their course 
• what makes them comfortable when learning 
• their interests and hobbies. 

2. You can find out about learners by: 
• looking at any interview notes made during placement tests, if they were interviewed 
• having personal interviews in the first few days 
• giving the learners a questionnaire 
• asking the learners to interview each other and then write up the information on a poster 
• asking the learners to write about themselves in a letter of introduction to you or a brief autobiography 
• talking to their previous teachers if they are just moving into your class 
• looking at any records kept on them in the school/college (If you go to a school/college where no 
records are kept, start keeping records like the profiles above and suggest that the school/college 
does so, if you can.) 

You can use the points in the previous tasks to write the questions for your interview or questionnaire, or 
to give the learners a framework for what to write about.$pctxt$
from public.pre_course_task_sections where source = 'cambridge' and sequence_index = 1;

insert into public.pre_course_task_items (section_id, task_number, sequence_index, prompt, answer)
select id, 4, 4, $pctxt$If you were teaching a group of learners, each of whom had different motivations for learning English, which 
learners would be the most challenging in terms of motivation? 

 
D The qualities and skills of a good language teacher 

Learners expect to find in their teachers someone with whom they can work comfortably and someone with the 
skills to enable them to achieve their goals.$pctxt$, $pctxt$The challenge comes when learners are unsure of their goals, have been told by parents or employers 
that they have to do the course, or they have to do the course because the next course or their job 
demands it, and they have no interest in the language or the culture. What seems to be critical in 
motivation is the strength of the motivation.$pctxt$
from public.pre_course_task_sections where source = 'cambridge' and sequence_index = 1;

insert into public.pre_course_task_items (section_id, task_number, sequence_index, prompt, answer)
select id, 5, 5, $pctxt$Look at the list of qualities and skills that a teacher might have. Which do you think learners most often rate in 
the top five? 

• has a sense of humour 
• has a calm presence 
• builds rapport 
• is approachable 
• knows how to listen well to students 
• trusts learners 
• is patient 
• respects individuality 
• gives clear information and feedback 
• knows about language and learning 
• inspires confidence 
• is sensitive to learners as people 
• paces lessons to match the learners 
• is methodical and well-organised 
• plans well 
• can be authoritative without being distant 
• is always learning and developing 
• is enthusiastic and inspires enthusiasm 
• is friendly 
• is honest 
• empathises with the learners 
• does not complicate things unnecessarily 
• is sensitive to the culture and backgrounds of the learners 

 
Adapted from Scrivener, J (1994) Learning Teaching, Harlow: Macmillan Heinemann pp. 7-8$pctxt$, $pctxt$This will vary from class to class. Learners filling in feedback forms or questionnaires often say they like 
teachers who: 
• are friendly and kind 
• have a good sense of humour 
• explain clearly 
• have patience 
• know their subject. 
Section 2 Language Analysis and Awarenesss$pctxt$
from public.pre_course_task_sections where source = 'cambridge' and sequence_index = 1;

insert into public.pre_course_task_items (section_id, task_number, sequence_index, prompt, answer)
select id, 6, 1, $pctxt$Make a list of associations you have with the word ‘grammar’. (They may not all be negative!) 

 
Grammar is sometimes perceived as being something abstract and difficult, associated with the analysis of very 
long sentences. While it is possible for a teacher to create this impression, grammar is something that we use 
every day whenever we speak or write. 

Simply put, grammar is a ‘system’ that we use to express meaning. When we have a thought that we want to 
articulate in spoken or written form, we use the system of grammar to encode our ideas so that others will 
understand them. We also use the vocabulary and pronunciation systems to add to meaning. 

Many of us speak and write English extremely well without having any explicit knowledge of grammar. 
However, native speakers do have implicit knowledge of grammar and use it correctly.$pctxt$, $pctxt$There is no answer to this task. Often native speakers find the idea of the grammar of their own language 
overwhelming. This might be because they were never taught it at school or, if they were, they were 
taught it badly. People who have studied a second language may have more awareness of grammar, but 
they might only know the terminology in their own language. Those who have studied linguistics at 
university might feel more comfortable with grammar.$pctxt$
from public.pre_course_task_sections where source = 'cambridge' and sequence_index = 2;

insert into public.pre_course_task_items (section_id, task_number, sequence_index, prompt, answer)
select id, 7, 2, $pctxt$Look at the following sentences and decide which are correct. Write a correct version of the examples that are 
incorrect. 
1. We’ve been looking for you for ages. 
2. I’ve been to the movies last night. 
3. He often come late. 
4. They were waiting by the fountain. 
5. Can I have a coffee black, please? 
6. People with 12 items or less can queue here. 

 
A clear indication of our implicit grammar knowledge is our ability both to distinguish between correct and 
incorrect language, and to be able to correct what is incorrect. However, to work as an effective English 
language teacher, we need to develop good explicit language knowledge. To do this means we need to build up 
our knowledge of grammar.$pctxt$, $pctxt$1. Correct 
2. Incorrect - I went to the movies last night. 
3. Incorrect - He often comes late. 
4. Correct 
5. Incorrect - Can I have a black coffee, please? 
6. Incorrect - People with 12 items or fewer can queue here. (Although the incorrect version is 
commonly used - for example in supermarkets - and fewer people are using 'fewer'!)$pctxt$
from public.pre_course_task_sections where source = 'cambridge' and sequence_index = 2;

insert into public.pre_course_task_items (section_id, task_number, sequence_index, prompt, answer)
select id, 8, 3, $pctxt$Provide a list of reasons why English language teachers need to know about grammar. In doing so, try to give 
some thought to the learners’ perspective. 

 
Word class 

One of the first steps in developing explicit awareness involves familiarising yourself with the component parts 
of the grammatical system. We need to know what different grammatical class words belong to. In other 
words, are they nouns, pronouns, verbs, adjectives, adverbs etc.? We need to know their word class (another 
term for this is part of speech). 

Grammar reference books can help you with this. However, good dictionaries are another source of this 
information.$pctxt$, $pctxt$They key reason here is that teachers need to be able to help learners with their language and having 
explicit knowledge of language is necessary in order to do this as completely and as efficiently as 
possible. If a learner produces an incorrect utterance, a teacher not only needs to give a correct model, 
but should also be able to go on and say why the learner's version was incorrect. This is only possible if 
we know the grammar and terminology. 

A second reason concerns learners' expectations. We expect a mathematics teacher to know about 
mathematics. Likewise, an English language teacher should know about language. 

Most coursebooks and many syllabuses in schools include a specific focus on grammar on a reasonably 
regular basis. In order to be able to interpret and deliver lessons from these resources, we need to 
develop grammatical knowledge.$pctxt$
from public.pre_course_task_sections where source = 'cambridge' and sequence_index = 2;

insert into public.pre_course_task_items (section_id, task_number, sequence_index, prompt, answer)
select id, 9, 4, $pctxt$Identify the underlined words in the following dialogue. Use a grammar reference book or a dictionary to help 
you with this if necessary. 
A: What are you(1) looking at? 
B: Well, it’s a(2) photograph of something very close up, but(3) I can’t work out what it is. 
A: Yes, it’s quite(4) abstract(5), isn’t it? 
B: Yes. It could(6) be one of those(7) things for(8) unblocking a sink. 
A: Oh, you mean(9) a plunger(10). 

 
Types of verbs 

Much of the study of grammar centres around verbs and the way they behave in combination with each other. 
The reasons for this are that verbs help us convey a lot of information about states, actions, time and attitude 
and involve many subtleties of meaning that learners of English find quite challenging. 

We can look at verbs as belonging to two broad categories: lexical and auxiliary. Lexical verbs contain some sort 
of meaning and can stand alone. Therefore, in the sentence I love chocolate ice cream, the verb love is lexical: it 
has meaning and does not need another verb to help it in any way. 

However, other verbs fulfil the purpose of acting as a help or support to lexical verbs and are called auxiliary. 
For example, in the following sentence He’s watching TV at the moment the verb is (contracted with he to make 
he’s) performs the role of helping the main verb watch to make the present progressive tense and has no 
independent meaning of its own. 

Auxiliary verbs can help make tenses that contain more than one verb. They can also be used to create negative 
and interrogative (or question) forms. For example, to make the sentence He lives here negative, we need to 
add auxiliary does as well as not i.e. He doesn’t live here. In order to create a question, we add does and alter 
the word order i.e. Does he live here?$pctxt$, $pctxt$1. subject pronoun 6. modal auxiliary verb 
2. indefinite article 7. demonstrative determiner 
3. co-ordinating conjunction 8. preposition 
4. adverb of degree 9. verb 
5. adjective 10. noun$pctxt$
from public.pre_course_task_sections where source = 'cambridge' and sequence_index = 2;

insert into public.pre_course_task_items (section_id, task_number, sequence_index, prompt, answer)
select id, 10, 5, $pctxt$Decide if the underlined verbs in the following sentences and questions are lexical verbs or auxiliary verbs. 
1. He watches TV for at least two hours every evening. 
2. What are you looking for? 
3. They aren’t going to come. 
4. What does he want? 
5. They haven’t been here before. 
6. He was waiting on the corner. 

 
There are three auxiliary verbs that have the function of creating different forms: be, do and have. (Remember 
that be has different present and past forms: am, are, is, was and were.) However, all three can also function as 
lexical verbs as well. In the sentence They didn’t arrive on time the verb do (in its past form did) has the function 
of an auxiliary verb to help create the negative form. However, in the sentence I did my homework last night 
the verb do (again in its past form did) functions as a lexical verb that carries meaning.$pctxt$, $pctxt$1. lexical 
2. lexical 
 4. auxiliary 
5. auxiliary 
3. auxiliary 6. lexical$pctxt$
from public.pre_course_task_sections where source = 'cambridge' and sequence_index = 2;

insert into public.pre_course_task_items (section_id, task_number, sequence_index, prompt, answer)
select id, 11, 6, $pctxt$Decide if the underlined verbs be, do and have have an auxiliary or lexical function in the following sentences 
and questions. 
1. I had a bad headache yesterday. 
2. When do you get up each day? 
3. How long have you been learning English? 
4. I did it without thinking. 
5. We do some exercise every morning. 
6. Have you had them long? 
7. I was hoping for a quick answer. 
8. Are they still here? 

 
When be, do and have are used as auxiliaries, they do not really have any meaning as such. However, there is 
another group of auxiliary verbs that do carry some meaning: can, could, may, might, will, would, shall, should 
and must. These are known as modal auxiliary verbs. 

Modal auxiliary verbs are similar to other auxiliary verbs in that they cannot stand alone. Therefore, we cannot 
say I must on its own as it does not convey a clear message to someone listening to the conversation. However, 
if we add the lexical verb go (I must go) then the utterance is more complete and makes sense. (Of course, I 
must on its own is perfectly possible as a response, as is the case with other auxiliary verbs). 
It is also worth noting that I must go contains more meaning than I go. The must adds a sense of obligation or 
necessity.$pctxt$, $pctxt$1. lexical 5. lexical 
2. auxiliary 6. lexical 
3. auxiliary 7. auxiliary 
4. lexical 8. lexical$pctxt$
from public.pre_course_task_sections where source = 'cambridge' and sequence_index = 2;

insert into public.pre_course_task_items (section_id, task_number, sequence_index, prompt, answer)
select id, 12, 7, $pctxt$All of the following sentences (1-5) contain modal auxiliary verbs that are underlined. Match the meaning of the 
modal verb to the definitions below (A-E). 
1. You should see a doctor as soon as you can. 
2. You may go now, thank you. 
3. This letter must be from Frank – he’s the only one who hasn’t written so far. 
4. I can’t play the piano very well. 
5. We could go out, but I don’t know if I’m in the mood. 

A. Ability 
B. Logical deduction 
C. Advice 
D. Possibility 
E. Permission 

 
Verb forms 

All verbs have a base form. This is the form of the verb when nothing extra is added. In the following sentence: 
Listen more carefully! 
‘listen’ is the base form of the verb (in this case it is being used as an imperative). 

Sometimes we add letters to verbs in order to change the form. In the following sentence: 
He mostly listens to jazz these days. 
an –s has been added to the base form of ‘listen’ in order to create the 3rd person singular of the present 
simple tense.$pctxt$, $pctxt$1 - c 2 - e 3 - b 4 - a 5 - d$pctxt$
from public.pre_course_task_sections where source = 'cambridge' and sequence_index = 2;

insert into public.pre_course_task_items (section_id, task_number, sequence_index, prompt, answer)
select id, 13, 8, $pctxt$Match the underlined verb form examples to the correct definition. 

1. I worked until 7 o’clock last night. 
2. They’ve been seeing a lot of each other lately. 
3. She lives not far from here. 
4. You have to try harder. 
5. It was handed to me as I was leaving. 

verb form 
base form 
3rd person –present simple tense 
past tense form 
past participle form 
-ing form 

 
Most of these forms have more than one use. For example, -ing forms can be present participles when they act 
as a verb as in the following sentence: I’m working as hard as I can. However, they can also be used as gerunds 
when they act as a noun as in the following example: Walking is good for your health. 

Past forms and past participle forms can be regular or irregular. Regular past forms and past participle forms 
are identical as –ed is added to the base form to create both forms. For example: 
base form past form past participle form 
work worked worked 

However, this changes if the verb is irregular. For example: 
base form past form past participle form 
make made made 
give gave given 

Note that with some irregular verbs, the past form and the past participle form are the same (make above), 
while others have different past and past participle forms (give above). 

It is not possible to look at the base form of a verb and determine whether it is regular or irregular. Native 
speakers know this information implicitly, while learners of English usually have to memorise lists of irregular 
verbs.$pctxt$, $pctxt$verb form Example 
base form You have to try harder. 
3rd person - simple present tense She lives not far from here. 
past tense form I worked until 7 o'clock last night. 
past participle form It was handed to me as I was leaving. 
- ing form They've been seeing a lot of each other lately.$pctxt$
from public.pre_course_task_sections where source = 'cambridge' and sequence_index = 2;

insert into public.pre_course_task_items (section_id, task_number, sequence_index, prompt, answer)
select id, 14, 9, $pctxt$Think of the past form and the past participle forms of the following verbs. Which are 
regular? Which are not regular? 
hear 
think 
go 
do 
take 
drink 
help 
steal 
arrive 

Verb phrases 

When we speak, we mix and match different verb forms of both auxiliary and lexical verbs in order to create 
different verb phrases. These choices are sub-conscious. For example, we can combine the base form have 
with the past participle of be
 been together with the -ing form of a lexical verb in order to create a verb 
phrase that describes an action that began in the past and continues until the present: 
I have been waiting here for half an hour. 
In this sentence have and been are both auxiliary. 

Alternatively, we can combine the modal should with the base form of have and the past participle of a lexical 
verb in order to create a verb phrase that can be used to criticise someone. 
You should have studied much harder for the exam. 
In this sentence should and have are both auxiliary. 

The choice of verb follows a pattern: 
1. Tense past or present? They give … vs. They gave … 
2. Modal They can / must / would / should give … 
3. Simple They give / gave 
4. Perfect aspect They have / had given … 
5. Progressive aspect They are / were giving … 
6. Voice They give … vs. They are given … 

 
We can include many different elements. For example, They have been giving out brochures combines present 
tense with both the perfect and progressive aspects to create the present perfect progressive. In the example, I 
was given this brochure the past tense combines with the passive voice to create the past passive.$pctxt$, $pctxt$Base form simple past past participle 
hear heard heard 
do did done 
think thought thought 
take took taken 
steal stole stolen 
go went gone / been 
drink drank drunk 

arrive and help are regular$pctxt$
from public.pre_course_task_sections where source = 'cambridge' and sequence_index = 2;

insert into public.pre_course_task_items (section_id, task_number, sequence_index, prompt, answer)
select id, 15, 10, $pctxt$Identify the different elements (past, present, modal, perfect, progressive, passive) underlined in the 
following verb phrases. 

1. I was hoping to see you. 
2. They might have got home by now. 
3. We have tried to help. 
4. They were being questioned at length. 
5. I saw it coming. 
6. This time next week you will be lying on a beach. 

 

While we have focused on these different elements in terms of identifying their form, it is worth remembering 
that these changes also affect the meaning of the verb phrase. 

So far, we have called these combinations verb phrases. In many grammar reference books, English language 
course books and other materials, they are often known as tenses. Therefore, each verb phrase can be labelled 
with a tense name for ease of identification. Look at the following example: 
I’m studying really hard at the moment. 
The auxiliary verb am (from be) is in the present tense, while the -ing form of the lexical verb study indicates a 
progressive form. They combine to create what is known as the present progressive tense (often called the 
present continuous). 

Here is another example: 
Her jewellery has been stolen. 
The auxiliary have is in the present tense; it combines with be (been – past participle form) to indicate the 
passive voice; been also combines with a second past participle stolen to indicate the perfect aspect. The three 
combinations create the present perfect passive tense.$pctxt$, $pctxt$1. past, progressive 4. past, progressive, passive 
2. modal, perfect 5. past, simple 
3. present, perfect 6. modal, progressive$pctxt$
from public.pre_course_task_sections where source = 'cambridge' and sequence_index = 2;

insert into public.pre_course_task_items (section_id, task_number, sequence_index, prompt, answer)
select id, 16, 11, $pctxt$Identify the tense names of the underlined verbs in the following sentences. You will most likely need to 
refer to a grammar reference book to help you. 

1. I am having a really good time. 
2. We stopped doing that years ago. 
3. She lives somewhere near here. 
4. We had been for a drink before we met him. 
5. These computers are made in China. 
6. You will have been here for 2 days by then. 
7. It happened as I was driving home. 
8. I have been feeling unwell for a while. 

 

Grammar and meaning 

Different tenses have a variety of uses or meanings. In most cases, tenses give us some indication of time 
reference. For example in the sentence: 
I played squash with Liz yesterday afternoon. 
the use of the simple past with the verb played signals that the action took place in the past. However, there is 
not always a one-to-one relationship between tenses and the time they refer to. For example, in the following 
question: 
What if I wanted to go now? 
the simple past is used, but the time reference is now, the present. In this example, the simple past has been 
used to emphasise an idea of hypothesis. The speaker is speculating on a scenario that is different from the real 
present. Therefore, in the above question, we can say that the simple past has been used to show distance 
from reality rather than distance from the present.$pctxt$, $pctxt$1. present progressive/continuous 
2. simple past 
3. present simple 
4. past perfect 
5. present passive 
6. future perfect 
7. simple past; past progressive/continuous 
8. present perfect progressive/continuous$pctxt$
from public.pre_course_task_sections where source = 'cambridge' and sequence_index = 2;

insert into public.pre_course_task_items (section_id, task_number, sequence_index, prompt, answer)
select id, 17, 12, $pctxt$The following examples of language contain different tenses which are underlined. The name of the tense 
is also given. Decide what the time reference of each example is and remember that the time reference 
may not match the tense name. 

1. The sun was shining brightly in the sky. (past progressive). 
2. They’ll have finished work on the bridge by then. (future perfect simple) 
3. She’s been working in the garden all morning. (present perfect progressive) 
4. Have you got a minute? I was wondering whether we could have a word. (past progressive) 
5. They own most of the land around here. (present simple) 

 
Present progressive 

In order to explore grammatical meaning in more detail, we will look at one example: the present progressive 
tense.$pctxt$, $pctxt$Name of tense Time referenee 
1. past progressive/continuous past 
2. future perfect future 
3. present perfect progressive/continuous past up until present 
4. past progressive/continuous present 
5. simple present past, present and probably future$pctxt$
from public.pre_course_task_sections where source = 'cambridge' and sequence_index = 2;

insert into public.pre_course_task_items (section_id, task_number, sequence_index, prompt, answer)
select id, 18, 13, $pctxt$• What auxiliary verb is used to create the present progressive? 
• What is the form of the lexical verb of the present progressive? 

 
The following dialogue contains examples of the present progressive. (N.B. the numbers at the beginning of 
each line are used for ease of reference). 

1. A: What are you up to? 
2. B: Can’t you see? I’m studying. 
3. A: But it’s the weekend. Boring! 
4. B: Yeah, well, I’ve got to. 
5. A: Why’s that? 
6. B: I’m doing a really intensive course at the moment. 

In line 2, the present progressive is used to talk about an action that takes place in the moment of speaking. 
Speaker B has a book in her hand and is studying. By contrast, the example of the present progressive in line 6 
refers to time around the moment of speaking. The dialogue takes place during the weekend and speaker B is 
clearly not at school when she indicates that she is following a course. The action of doing the course is 
something that is happening in speaker A’s life, even if she is not attending the course in the moment of 
speaking. 

Despite the small differences in meaning between the two examples, it is possible to note similarities in 
meaning. Both actions suggest an idea of on-going duration and both can be perceived as actions of limited 
duration. It is not expected they will continue forever.$pctxt$, $pctxt$Auxiliary 'be' (am, is are). The -ing form is used for the lexical verb.$pctxt$
from public.pre_course_task_sections where source = 'cambridge' and sequence_index = 2;

insert into public.pre_course_task_items (section_id, task_number, sequence_index, prompt, answer)
select id, 19, 14, $pctxt$Look at the following mini-dialogues below and decide the time reference or use of the underlined 
examples of the present progressive. 

A: How about going to a movie this evening? 
B: I can’t. I’m meeting Judy for a drink. 

A: Where’s Tony? 
B: I don’t know where he’s got to. 
A: He’s always running late. 

A: It was late at night and dark and I was on my way back to the hotel. Suddenly, I find I’m walking down 
the street all on my own and I can hear the sound of footsteps … 

 
In order to determine the use or meaning of tenses, it helps to look at them in context, even if it is a question of 
two lines of conversation. The sentence I’m meeting Judy for a drink clearly has future time reference in the 
above dialogue. However, look at the following dialogue that takes place in bar: 
A: Richard! How are you? What are you doing here? 
B: I’m meeting Judy for a drink. 
(B nods in the direction of a table where Judy is sitting.) 
In this context, the present progressive is being used to talk about an action that takes place at the moment of 
speaking.$pctxt$, $pctxt$I'm meeting - an arranged appointment in the future. 
He's always running late - refers to past present and probably future; the utterance describes an 
annoying habit. 
I'm walking - refers to past time; the speaker has shifted to the present tense to make the narrative more 
dramatic.$pctxt$
from public.pre_course_task_sections where source = 'cambridge' and sequence_index = 2;

insert into public.pre_course_task_items (section_id, task_number, sequence_index, prompt, answer)
select id, 20, 15, $pctxt$What is the problem with the following examples? 

1. He’s having a brother and a sister. 
2. I’m liking this ice cream. 
3. What are you thinking of your new job? 
4. This sauce is lacking salt. 

 

B Vocabulary 

Section B of this unit aims to: 
• highlight different aspects of the meaning of words 
• clarify key features of word formation. 

Words and dictionaries 

When we come across words that we do not know the meaning of, we often look in dictionaries to find out the 
meaning. Dictionaries can be a useful source of information about words for native speakers and learners of 
English.$pctxt$, $pctxt$The lexical verbs in all the examples have a state meaning. This kind of verb cannot normally be used in 
the progressive form. For example, you cannot say 'I'm knowing him very well'. The verb 'know' can 
only be used in the simple form. Here is a list of some of the verbs which are not normally used in the 
progressive form (though there are exceptions): want, like, dislike, hate, love, belong, believe, hear, 
understand, own, seem. 

Some verbs may have a state meaning and a 'dynamic' meaning. For example: What do you think about 
the weather? (state meaning - believe). What are you thinking about? (dynamic meaning - going on in 
your mind). He has long hair (state meaning - possess). He's having a party (dynamic meaning - 
giving/throwing).$pctxt$
from public.pre_course_task_sections where source = 'cambridge' and sequence_index = 2;

insert into public.pre_course_task_items (section_id, task_number, sequence_index, prompt, answer)
select id, 21, 16, $pctxt$Make a list of what extra information dictionaries can provide about words apart from the meaning. It 
would be a good idea to refer to a dictionary to help you. 

 
While you might have a reasonably good understanding of words in English, using a dictionary can provide you 
with a deeper knowledge of words and how they are used in spoken or written language or both. Dictionaries 
are an invaluable tool for an English language teacher. 

Meanings 

Learners of English usually like learning vocabulary because words often generate clear meaning even when 
they are unsure of the grammar. A non-native speaker who goes into a café and says Coffee please will most 
likely succeed in obtaining a cup of coffee despite the fact he or she did not say Can I have a cup of coffee 
please? 

However, while words are powerful and useful units of meaning, they can sometimes be problematic. Many 
words have more than one meaning and sometimes defining exactly what a word means can be complex.$pctxt$, $pctxt$Good dictionaries will usually give information on the following: 
• The part of speech of the word; other grammar information e.g. it will say whether a verb takes an 
object (transitive - T) or not. 
• It will provide an example sentence to show the word in context. 
• It may suggest what other words this word typically occurs together with. 
• It will indicate whether the word is formal or colloquial. 
• If relevant, it will probably indicate whether the meaning has a negative or a positive connotation. 
• It provides the pronunciation of a word by means of phonemic transcription.$pctxt$
from public.pre_course_task_sections where source = 'cambridge' and sequence_index = 2;

insert into public.pre_course_task_items (section_id, task_number, sequence_index, prompt, answer)
select id, 22, 17, $pctxt$In the following sentences, there is a vocabulary error of some kind. Identify and describe the problem. 

1. He’s the highest person in the family by more than 2 centimetres. 
2. I think I’ll go to bed now. I’m feeling a little enervated. 
3. It is an extremely good essay. The ideas in it are original and pretentious. 
4. Her grandfather gave her a loving slap on her face. 
5. Every day I like to go footing after work. It’s good exercise and it helps me to relax. 

 
When thinking about the meaning of words in English, we often need to consider different aspects of meaning. 
The first thing to think about is what the word means. In other words, what is a simple definition of the word as 
we would find in a dictionary. This is the semantic meaning. 

We might also need to think about how we would typically use this word. For example, is it a formal word, a 
neutral word or a less formal and more colloquial word? For example, in sentence 2, enervated is a more formal 
word than tired and sounds strange in an everyday conversation. This is what is called the register of the word. 

With some words it is important to think about whether the word has a positive or negative meaning. For 
example, in sentence 3 above, we can say that pretentious has a more negative meaning than the word clever. 
This is what we call connotation. 

Finally, it is sometimes useful to think what words go together with other words. In sentence 1 above, high 
does not go together with people. It is more typically used with buildings. It is better to use the word tall when 
talking about people. This is known as collocation.$pctxt$, $pctxt$1. He's the tallest person . We use high with buildings and mountains but not with people when 
referring to physical height. 
2. . feeling a little tired. 'Enervated' feels a little too formal for this context and it is more typically used 
to describe an activity in its -ing form rather than to describe a feeling or sensation. 
3. . original and clever. The word 'pretentious' has a negative connotation in English and the sentence 
suggests that the speaker would like to praise rather than give negative feedback. 
4. . loving touch on the face. While 'slap' indicates contact between the face and another person's 
hand, the force of that contact is not generally considered as being 'loving'. 
5. . to go jogging after work. . Footing is a word which has been adopted 'incorrectly' by another 
language (in this case French). The French for jogging is footing.$pctxt$
from public.pre_course_task_sections where source = 'cambridge' and sequence_index = 2;

insert into public.pre_course_task_items (section_id, task_number, sequence_index, prompt, answer)
select id, 23, 18, $pctxt$In the following sentences, you can find the following examples of collocation: 
2 verb-noun collocations; 1 verb-preposition collocation; 1 adjective-noun collocation; 3 adverb-
adjective collocations. 

Underline and identify these different examples. Note: some sentences contain more than one 
collocation. 

1. Not only was he nice, but he was also strikingly handsome. 
2. After he got up, he made his bed and did some housework. 
3. It was absolutely fabulous! 
4. They both really depend on each other. 
5. Their farewell at the airport was highly emotional. 
6. She was caught in a vicious circle. 

 
To summarise, in order to be able to say we know the meaning of a word, we need to think about the following: 
• semantic meaning 
• register 
• connotation 
• collocation 

C Phonology 

Section C of this unit aims to: 
• clarify key terminology associated with pronunciation 
• highlight the role phonology has to play in English language teaching 
• exemplify the relationship between sounds and phonemic script 
• illustrate stress in individual words. 

Overview 

Phonology is the study of speech sounds. It is related to the ‘noises’ we produce when we speak English. This 
includes not only individual sounds, but also different rhythms and the way our voices rise and fall.$pctxt$, $pctxt$Verb-noun: make + bed; do + housework 
Verb-preposition: depend + on 
Adjective-noun: vicious + circle; 
Adverb-adjective: strikingly + handsome; highly + emotional; absolutely + fabulous$pctxt$
from public.pre_course_task_sections where source = 'cambridge' and sequence_index = 2;

insert into public.pre_course_task_items (section_id, task_number, sequence_index, prompt, answer)
select id, 24, 19, $pctxt$Match the terms 1-3 with the definitions A – C. 

1. stress 
2. phoneme 
3. intonation 

A. the music of our voices 
B. giving emphasis to one syllable 
C. an individual sound 

It is important to focus on phonology in the classroom because, if incorrect, it can lead to breakdowns in 
communication between two speakers conversing in English.$pctxt$, $pctxt$1. - b 
2. - c 
3. - a$pctxt$
from public.pre_course_task_sections where source = 'cambridge' and sequence_index = 2;

insert into public.pre_course_task_items (section_id, task_number, sequence_index, prompt, answer)
select id, 25, 20, $pctxt$Match the problems 1-3 with the outcomes A-C. 

1. an individual sound is mispronounced 
2. a request is made with very flat intonation 
3. the wrong syllable is stressed in a word 

A. the word is incomprehensible 
B. the listener might understand ‘bin’ when the speaker wanted to say ‘pin’ 
C. the speaker can sound arrogant and demanding 

 
Individual sounds 

In any language we can identify a set of meaningful sounds (vowels and consonants) that we call phonemes. For 
example, the vowel sounds in the words 'pin' and 'pen' are different phonemes; the consonants at the 
beginning of the words 'pet' and 'bet' are likewise phonemes. 

English spelling is quite confusing for native speakers and foreign learners alike. The following words all end 
with the letters '-ough', but are all pronounced differently: enough, through, thorough, cough. This means it is 
important to think of the pronunciation of English in terms of phonemes rather than letters of the alphabet. 

We often use special phonemic symbols to represent the sounds in English. Many foreign learners are familiar 
with these symbols and use them as a tool for learning the pronunciation of new words. They are also 
commonly found in English dictionaries. English language teachers also need to be familiar with them. 

Below is a list of English phonemes with an example word beside each one. The letter(s) underlined indicate the 
sound referred to. 
Using these symbols we can write complete words using phonemic script. Look at the following examples (and 
note that words written in phonemic script are written between slanting lines):$pctxt$, $pctxt$1. - b 
2. - c 
3. - a$pctxt$
from public.pre_course_task_sections where source = 'cambridge' and sequence_index = 2;

insert into public.pre_course_task_items (section_id, task_number, sequence_index, prompt, answer)
select id, 26, 21, $pctxt$What are these words? 

 

Word Stress 

All words of two or more syllables in English have word stress. The stress can be marked by putting a box (or 
circle) over the vowel sound in the stressed syllable.$pctxt$, $pctxt$1. their 6. call 
2. south 7. search 
3. language 8. equation 
4. peaceful 9. sugar 
5. young$pctxt$
from public.pre_course_task_sections where source = 'cambridge' and sequence_index = 2;

insert into public.pre_course_task_items (section_id, task_number, sequence_index, prompt, answer)
select id, 27, 22, $pctxt$Where does the stress fall on the following words? 

1. guarantee 2. cavalry 

3. mechanisation 4. language 

5. retreat 6. speculative 

7. success 8. balance 

9. identity 10. articulate (adjective) 

 
There are few hard and fast rules that govern word stress. One rule that does work is that words ending in –ion 
(e.g. station, election, division etc.) have stress on the syllable immediately before the –ion syllable. This is the 
case even for quite long words:$pctxt$, $pctxt$n n 
1. guarantee 6. speculative 

 
n n 
2. cavalry 7. success 

 
n n 
3. mechanisation 8. balance 

 
n n 
4. language 9. identity 

 
n n 
5. retreat 10. articulate$pctxt$
from public.pre_course_task_sections where source = 'cambridge' and sequence_index = 2;

insert into public.pre_course_task_items (section_id, task_number, sequence_index, prompt, answer)
select id, 28, 23, $pctxt$1. Mark the main stress on the words in the following 'word family'. Why do you think non-native speakers 
often experience problems with these words? 

 photograph photography photographer photographic 

2. Mark the stress in the following pairs of words. Can you identify a pattern? 

 to record / a record to increase / an increase 
 to present / a present to import / an import 

 

Weak forms 

The most common vowel sound in English is the sound found in many unstressed syllables. It is called the 
'schwa' and is denoted by the symbol /ə/. For example: ‘father’ ends with the /ə/ sound. 

The first syllable is stressed. The second syllable is unstressed and contains the weak sound.$pctxt$, $pctxt$n n n n 
1. Photograph photography photographer photographic 

Non-native speakers find the shifting stress in this word family extremely confusing. 

n n n n 
2. to record/a record to increase/an increase 

n n n n 
3. to present/a present to import/an import 

 
In two-syllable nouns the main stress is on the first syllable. In two-syllable verbs the main stress is on 
the second syllable.$pctxt$
from public.pre_course_task_sections where source = 'cambridge' and sequence_index = 2;

insert into public.pre_course_task_items (section_id, task_number, sequence_index, prompt, answer)
select id, 29, 24, $pctxt$Underline the /ə/ in the following words: 

mother forget announce tonight notable mention patrol indicative$pctxt$, $pctxt$Mother forget announce tonight notable mention patrol indicative 
Section 3 Language Skills: Reading, Listening, Speaking and Writing$pctxt$
from public.pre_course_task_sections where source = 'cambridge' and sequence_index = 2;

insert into public.pre_course_task_items (section_id, task_number, sequence_index, prompt, answer)
select id, 30, 1, $pctxt$Think of all the texts you have read so far today and comment on the way in which you have read these texts. 

 
Typically, native speaker readers deploy different reading sub-skills when they approach texts. We do not do 
this as a conscious process, but we do it spontaneously in reaction to the type of text we are reading. 

Common terminology associated with reading sub-skills is as follows: 
Scan reading  when you read to find a specific piece of information 
Skim/gist reading  when you read to get the overall idea of a text 
Intensive/detailed reading  when you read to get a lot of information from a text 
Reading to infer  when we read to understand a writer’s implicit message in a text$pctxt$, $pctxt$There is no answer as such to this task. It is interesting to consider the variety of texts that a person 
reads in any one day. These can range from billboards to instructions on an instant soup packet; from an 
e-mail message to a novel you happen to be reading at the moment. And, of course, it includes this task.$pctxt$
from public.pre_course_task_sections where source = 'cambridge' and sequence_index = 3;

insert into public.pre_course_task_items (section_id, task_number, sequence_index, prompt, answer)
select id, 31, 2, $pctxt$Below are some different text types. Think about which of the above reading sub-skills we would use to read 
these texts. 

1. An academic article we need to read for an essay we are writing. 
2. A telephone directory. 
3. The editorial of a newspaper on a topic we care about a lot. 
4. An advertisement for a job that might be suitable. 

 
When people read in a language that is not their first language, they often forget to use appropriate language 
skills and will read all texts in a great deal of detail. They are also likely to overuse bi-lingual dictionaries, 
pausing in their reading every time they find a word they do not understand.$pctxt$, $pctxt$1. An academic article - It is likely we would gist read this first to see to what degree it is relevant to the 
essay. We might then go back and read certain relevant sections in detail for information and/or to 
infer the writer's point of view on a particular subject. 
2. Telephone directory - We would scan this to locate the name and number we are searching for. 
3. Editorial - We would probably read this intensively given that it is a topic we care about and we would 
try to infer the point of view of the writer in relation to that topic. 
4. Job advertisement - We are likely to start by scanning the job advertisements section of a newspaper 
looking for the right kind of job. Initially, we would probably gist read the ad to see if we fit the 
requirements and, if so, read the ad in detail in order to make a decision about whether to apply or 
not.$pctxt$
from public.pre_course_task_sections where source = 'cambridge' and sequence_index = 3;

insert into public.pre_course_task_items (section_id, task_number, sequence_index, prompt, answer)
select id, 32, 3, $pctxt$• What problems are there with this way of reading? 

B Listening 

Ways of listening 

Learners often comment that they find reading texts easier than listening to texts. (‘Text’ here means anything 
from a conversation overheard to a radio news broadcast.)$pctxt$, $pctxt$It tends to break the flow of reading and means the reader can lose the thread of the text, thereby 
compromising comprehension. Compared to reading in your first language, this kind of reading behaviour 
is artificial and inefficient.$pctxt$
from public.pre_course_task_sections where source = 'cambridge' and sequence_index = 3;

insert into public.pre_course_task_items (section_id, task_number, sequence_index, prompt, answer)
select id, 33, 4, $pctxt$• Make a list of reasons why you think non-native speakers might find listening more challenging than 
reading. 

 
As is the case with reading, we do not always listen to everything in the same way. The way in which we listen is 
determined by what we are listening to, our motivation for listening and where we are listening. For example, 
you might be on a bus listening to two people gossiping about a work colleague who you do not know. In this 
situation, you are likely to tune in and out of the conversation or ignore it all together. However, if you 
recognise the name of their colleague and the gossip sounds particularly interesting, you are likely to listen 
more carefully (unless you feel it would be socially inappropriate to do so).$pctxt$, $pctxt$• They cannot control the speed of the text as they can when reading. 
• They cannot go back in the text to double-check information before moving forward. 
• The speed of delivery may be beyond a level of manageability for them. 
• They may not connect the sounds they hear to words they know. 
• They have to contend with different aspects at the same time. 
• If they listen to a recording, they will have no visual information to help them make sense of the text.$pctxt$
from public.pre_course_task_sections where source = 'cambridge' and sequence_index = 3;

insert into public.pre_course_task_items (section_id, task_number, sequence_index, prompt, answer)
select id, 34, 5, $pctxt$• Think of three different situations in which you listened today. Make a note of who you were listening to, 
your motivation for listening and describe how you listened. 

 
All of the above suggests that listening is similar to reading in the way that there are different sub-skills that we 
use when we listen. We can more or less use the same labels: 
• Scan listening 
• Skim/gist listening 
• Intensive listening 
• Listening to infer meaning$pctxt$, $pctxt$As with task 30 above, the answer will depend on your individual circumstances. You may have listened 
to the radio, gossip from a friend, a university lecture or a recorded voice mail message.$pctxt$
from public.pre_course_task_sections where source = 'cambridge' and sequence_index = 3;

insert into public.pre_course_task_items (section_id, task_number, sequence_index, prompt, answer)
select id, 35, 6, $pctxt$Match the above listening sub-skills to the following listening texts. 

1. A lecture for a course you are taking at university. 
2. A sales pitch for a computer that doesn’t really interest you. However, you are at work and you can’t just 
walk out. 
3. Announcements at a train station when you are waiting to hear the time of the next train to your 
destination. 
4. Instructions from your boss for a new task that is critical for your job. 
5. An interview with someone who is famous and whose political opinion you would like to find out about. 
6. A radio programme on a topic that is mildly interesting for you. 

 

C Speaking 

Ways of speaking 

When we ask about someone’s ability in a second language, the usual way of checking this is by saying “Do you 
speak …?”. This suggests that spoken language is seen as the most important of all the language skills. 

Often learners who have studied English for two years (or more) in their home countries are still not able to 
really speak English. They will often complain by saying that their previous learning was very grammar-focused 
and that they are not very ‘fluent’ in English.$pctxt$, $pctxt$1. Lecture - You are likely to have listened quite intensively and made notes. At times, you might need 
to infer meaning from the lecture. 
2. Sales pitch - Your lack of motivation probably meant that you only listened for the gist of what the 
salesperson was saying. 
3. Announcements - You would scan listen for your destination, then listen intensively for your 
departure time. 
4. Instructions - The critical nature of the task means that you would listen intensively. 
5. Interview - You would be motivated to listen in detail and to infer meaning in order to determine the 
speaker's political position. 
6. Radio programme - If your interest is not strong, then you would most likely gist listen to the 
interview, unless perhaps you were bored and had nothing better to do.$pctxt$
from public.pre_course_task_sections where source = 'cambridge' and sequence_index = 3;

insert into public.pre_course_task_items (section_id, task_number, sequence_index, prompt, answer)
select id, 36, 7, $pctxt$• Think about this disparity between 2 years’ study of a language and a lack of ability to speak. Why do you 
think this happens? 

 
While grammar is important, students need to learn how to activate their passive grammatical knowledge by 
way of oral practice of grammar. At the same time, they need to be able to practise speaking fluently without 
worrying too much about grammar. The aim is for them to focus on the message and on communicating 
effectively.$pctxt$, $pctxt$Study of grammar (and vocabulary) alone is likely to lead to passive knowledge of the language. Most 
learners need to practise speaking in order to be able to activate what they have learnt. This means t hat 
speaking is a skill that involves different strategies. Further, speaking is the only way for learners to have 
practice of the pronunciation of English. Our rhythm and sounds can be quite challenging for some 
learner groups.$pctxt$
from public.pre_course_task_sections where source = 'cambridge' and sequence_index = 3;

insert into public.pre_course_task_items (section_id, task_number, sequence_index, prompt, answer)
select id, 37, 8, $pctxt$Look at the following examples of learner language and decide whether the student has managed to 
communicate successfully or not. 

1. Could I please have a ….? (learner gesticulates, indicating he is unsure of the word) 
2. You come my house tonight? (said with rising intonation) 
3. Yesterday good time. Next week we see, no? (learner smiles) 
4. A: How long have you been in New Zealand? 
 B: I stay here 5 weeks. 

 
Most oral interaction can usually be described as transactional or interactional. Transactional communication 
takes place when you want the person you are addressing to do something as a result of the communication. 
For example, you may want to find out information, buy a product or get feedback on some kind of task that 
you have performed. Conversely, interactional communication fulfils a more social role. You may just want to 
chat with a friend or make small talk with a colleague.$pctxt$, $pctxt$1. Not very successful - although the learner uses correct grammar, the speaker doesn't know what the 
listener wants. 
2. Successful - the grammar is not correct, but the message is clear. 
3. Successful - the same as 2. 
4. Not very successful - the answer is ambiguous in terms of whether it refers to past or future time. B 
might have understand 'How long .' as referring to the future and their answer may refer to the 
amount of time left in New Zealand.$pctxt$
from public.pre_course_task_sections where source = 'cambridge' and sequence_index = 3;

insert into public.pre_course_task_items (section_id, task_number, sequence_index, prompt, answer)
select id, 38, 9, $pctxt$Decide if the following descriptions of conversations are transactional or interactional. 

1. You ask a colleague if s/he would mind helping you with something. 
2. You offer to collect your neighbour’s mail while s/he is away on holiday. 
3. You comment on the weather to an acquaintance at a bus stop. 
4. You visit a friend and spend time admiring and talking about his/her garden. 
5. You participate in a university group tutorial that is useful for an essay you are writing. 
6. You go out with your boss and other colleagues for a drink after work. 

 
Some learners are unsure of the value of doing speaking fluency activities in the classroom. They feel that the 
teacher should closely monitor and correct their spoken language at all times. When teaching groups of 
between 10 and 20 learners who will sometimes work in pairs and small groups during the lesson, this kind of 
monitoring and feedback is sometimes difficult on a practical level. At the same time, there is also value for 
learners in having speaking fluency practice.$pctxt$, $pctxt$1. Transactional 4. Interactional 
2. Transactional 5. Transactional 
3. Interactional 6. Interactional$pctxt$
from public.pre_course_task_sections where source = 'cambridge' and sequence_index = 3;

insert into public.pre_course_task_items (section_id, task_number, sequence_index, prompt, answer)
select id, 39, 10, $pctxt$• Make a list of reasons why you think speaking fluency practice could help learners’ language development. 

 
D Writing 

Differences between written and spoken English 

Spoken and written English differ in many ways. It is not possible to say that written language is just spoken 
language written down. Conversely, spoken language is not like some kind of oral script that is already ‘written’ 
in our heads. It is tempting to say that written language is more organised than spoken language. However, 
applied linguists would dispute this and say that spoken language merely has different organisation from written 
language. Some people say that written language is more formal than spoken language. However, a text 
message sent from a mobile phone (written language) is likely to be far less formal than a parliamentary debate 
(spoken language).$pctxt$, $pctxt$• It gives them practice in the skill of speaking. 
• It gives them opportunities to put into practice language they have learned (including pronunciation) in 
a more spontaneous way. 
• It gives them practice in the use of communicative strategies, such as paraphrasing when they do not 
know the exact word or structure and, therefore, makes them more communicatively competent.$pctxt$
from public.pre_course_task_sections where source = 'cambridge' and sequence_index = 3;

insert into public.pre_course_task_items (section_id, task_number, sequence_index, prompt, answer)
select id, 40, 11, $pctxt$Which of the following characteristics would you associate with spoken language (S) and which with written 
language (W). 

1. Includes gesture and facial expression to back up the message. 
2. Uses punctuation to make the content easier to understand. 
3. Includes hesitation devices and fillers such as ‘yeah’, ‘umm’, ‘ah’ etc. 
4. The communicator usually gets immediate feedback from the person they are communicating with. 
5. Usually involves greater planning in advance. 
6. Uses pauses, stress and intonation to show where ideas begin and end. 
7. Is spontaneous and planning usually takes place in the moment of communicating. 
8. Suggests that meaning is static in the communication, although open to interpretation. 
9. The communicator may never find out what the person he is communicating with thinks of his message. 
10. Includes headlines, different type sizes and colours to enhance the content. 
11. Is usually smooth-flowing. 
12. Involves negotiation of meaning between the communicator and the person they are communicating with. 

 
Writing also involves many micro-skills such as correct letter formation (orthography), spelling and punctuation.$pctxt$, $pctxt$1. - S 7. - S 
2. - W 8. - W 
3. - S 9. - W 
4. - S 10. - W 
5. - W 11. - W 
6. - S 12. - S$pctxt$
from public.pre_course_task_sections where source = 'cambridge' and sequence_index = 3;

insert into public.pre_course_task_items (section_id, task_number, sequence_index, prompt, answer)
select id, 41, 12, $pctxt$Look at the learner errors in the sentences below. Identify the mistakes and try to decide why the learner made 
these mistakes. 

1. She through the ball hard so it hurt when I court it. 
2. My brther livs in Swedn. 
3. However, hard I try it never works. 
4. first of all he invited me to sit down after that he offered me a coffee I was very surprised by his politeness 

 
These skills can be particularly challenging for learners whose first language does not have a Roman script, for 
example, Arabic and Chinese speakers.$pctxt$, $pctxt$1. through and threw have exactly the same pronunciation despite the difference in spelling. 
2. This could be an indicator of general literacy problems or the absence or restricted use of vowels 
could be related to the fact the writer's first language does not distinguish between the quality of 
vowel sounds. 
3. The writer has 'over-learnt' the punctuation rule about however being followed by a comma. This is 
only the case when however is being used to introduce a contrasting idea. 
4. The learner has little awareness of the need to punctuate written text. This might be a result of 
interference from his/her first language.$pctxt$
from public.pre_course_task_sections where source = 'cambridge' and sequence_index = 3;

insert into public.pre_course_task_items (section_id, task_number, sequence_index, prompt, answer)
select id, 42, 13, $pctxt$1. Look at the samples of learners’ writing below and identify the difficulties encountered by these learners 
and other learners whose first language do not have a Roman script. 

2. Suggest some activities that teachers can use to help students to develop basic writing skills.$pctxt$, $pctxt$Holding the pen, writing from left to right, writing on the line, maintaining consistent letter size, 
differentiating between upper case and lower case, using upper case and lower case appropriately, 
punctuation, paragraphing, sequencing. 
Section 4 Planning and Resources$pctxt$
from public.pre_course_task_sections where source = 'cambridge' and sequence_index = 3;

insert into public.pre_course_task_items (section_id, task_number, sequence_index, prompt, answer)
select id, 43, 1, $pctxt$Below are some extracts from lesson plans. Decide which part of the lesson plan (1-7 above) they may come 
from. 

Extract Probably from 

a. I’d like to smile more and create a better rapport today. 

b. Students  Students in pairs 

c. By the end of the lesson students will be able to use a range of 
adjectives to describe someone’s personality. 

 
d. Teacher hands out text and gives a different set of questions to 
each group. 

 
e. Some students may find the pronunciation of several words 
quite difficult. I must make sure I use lots of repetition. 

 
f. To get students interested in the topic of the listening text. 

 

B Resources 

In your teaching situation you will have some resources available to you. The range will vary and depend on 
where you are teaching. Below is a list of possible resources you may be able to use. Match them to their uses.$pctxt$, $pctxt$a. Personal aim 
b. Interaction pattern 
c. Lesson aims/learning outcomes 
d. Procedure 
e. Anticipated problems and solutions 
f. Stage aim$pctxt$
from public.pre_course_task_sections where source = 'cambridge' and sequence_index = 4;

insert into public.pre_course_task_items (section_id, task_number, sequence_index, prompt, answer)
select id, 44, 2, $pctxt$Resource Can be used for 

1. Published coursebook a. Encouraging students to expand their vocabulary and to find out 
about new words on their own 

2. Cassette or CD player b. Developing students’ ability to read real texts 

3. Newspapers in English c. Giving students work which can be tailored to their individual 
needs 

4. Internet d. Developing students’ ability to listen to authentic speech 

5. Overhead Projector (OHP) e. Finding information on a particular topic area and developing 
reading skills 

6. Whiteboard f. Developing students’ language and skills in a structured way and 
allowing them to review at home 

7. TV/radio g. Developing students’ listening skills with specially prepared or real 
materials 

8. Teacher’s own materials h. Writing down new words for students to focus on, making the 
form, meaning or pronunciation features of a language area clear 

9. Dictionaries i. Showing pre-prepared work on a large screen for clarity$pctxt$, $pctxt$Resource Can be used for 
Published course book Developing learners' language and skills in a structured 
way and allowing them to review at home 
Cassette or CD player Developing learners' listening skills with specially 
prepared or real materials 
Newspapers in English Developing learners' ability to read real texts 
Internet Finding information on a particular topic area and 
developing reading skills 
Overhead Projector (OHP) Showing pre prepared work on a large screen for clarity 
Whiteboard Writing down new words for learners to focus on, making 
the form, meaning or pronunciation features of a 
language area clear 
TV / radio Developing learners' ability to listen to authentic speech 
Teacher's own materials Giving learners work which can be tailored to their 
individual needs 
Dictionaries Encouraging learners to expand their vocabulary and to 
find out about new words on their own 
Section 5 Developing Teaching Skills and Professionalism$pctxt$
from public.pre_course_task_sections where source = 'cambridge' and sequence_index = 4;

insert into public.pre_course_task_items (section_id, task_number, sequence_index, prompt, answer)
select id, 45, 1, $pctxt$Below are some instructions given by teachers. In each case the group of learners had difficulty following the 
instructions. For each one write: 
• Why do you think the difficulty occurred? 
• How could you give the same instruction in a more effective way? 

1. Jot that down. 

2. I wonder if you’d mind just looking at question number 4 and then if you could just answer it. 

3. I’d like you to read the text on page 4 and answer the first three, then compare your answers with the 
person next to you. After that write a short summary of the story and discuss this with your partner. 

4. Look at the question at the bottom of the page and think about an answer. 

 
Managing the learning environment 

Learners will often bring to your lessons strong views about how they want to learn and how you should teach. 
It is important that you listen to these views, but balance them with the views of the other students and with 
your own knowledge about teaching and learning. Some of the issues that may arise could be: 

Pair/group work 
As language is about communication, you maximise communication in the classroom by including some 
activities that learners do in pairs or small groups. You also use pair/group work to promote 
peer teaching, 
where learners help each other and reinforce their own learning. Some learners may be resistant to pair/group 
work, perhaps because they are used to a more teacher-centred approach, where all communication is through 
the teacher. They may also not want to work with certain individuals in the class or they may feel that they 
won’t learn when they are not talking directly to the teacher. 

 
Learning preferences 
We all learn differently and have a preferred approach or approaches to learning. Your learners will be keener 
to do activites that correspond to their learning preferences. So it is important to use a variety of learning 
materials and teaching approaches, which personalises your teaching for all your learners. 

Use of learners’ first language 
Many learners’ previous language learning experience may have been in monolingual classes, where the teacher 
also spoke the learners’ first language. Using the learners’ first language can be a useful tool for teaching and 
learning and many coursebooks suggest that learners use translation. On the other hand, it can also make the 
learner dependent on translation and at a loss, for example, when a language point arises where there is not a 
one-to-one translation with the first language. Also, in a 
multilingual classroom it would be impossible to expect 
the teacher to know all the languages represented!$pctxt$, $pctxt$1. Jot down is a phrasal verb. Phrasal verbs have idiomatic meanings which are often difficult for 
learners to understand. Write this would be more effective. 
2. The instructions include complicated language 'I wonder if you'd mind just' is difficult and long- 
winded. The teacher needs to simplify the language: Read question 4 and answer it or maybe even 
Answer question 4. 
3. Too many instructions are given at one time. The instructions would be more effective if they were 
given one by one before the learners needed to complete each stage: 
a. Teacher instructs "Read the text on Page 4 and answer questions 1, 2,and 3". 
b. Learners read and answer the questions. 
c. Teacher instructs "Compare your answers with the person next to you". 
d. Learners compare answers. 
e. Teacher instructs "Write a short summary of the story, discuss it with your partner". 
f. Learners write and discuss. 
4. This instruction is ambiguous. Should the learners think or should they answer?$pctxt$
from public.pre_course_task_sections where source = 'cambridge' and sequence_index = 5;

insert into public.pre_course_task_items (section_id, task_number, sequence_index, prompt, answer)
select id, 46, 2, $pctxt$Imagine you are the teacher of the students who made the comments below. How would 
you respond to them? 

1. I don’t want to work in a group because I will only learn mistakes from other students. 

2. I wish you could translate more words into my language. 

3. Please don’t ask me to work with that student. I don’t like people from her country. 

4. Could we just talk in class and not use any books? 

 
Organisation of the classroom 

One of the things you plan as a teacher is how you organise the physical environment of the classroom – desks, 
chairs, students, equipment, etc. How you organise the physical environment can have a significant impact on 
how effective your teaching and learning activities are. If, for example, you are planning something where 
students work in groups, it will help if all students in the group have eye contact. This may mean moving the 
seating so that they are facing each other. If you have a learner who has difficulty reading something on the 
board, you may need to ensure that this learner is seated near the board at all times.$pctxt$, $pctxt$You may need to explain the rationale of some of the classroom techniques mentioned earlier and used 
in class to learners who have not experienced these techniques before.$pctxt$
from public.pre_course_task_sections where source = 'cambridge' and sequence_index = 5;

insert into public.pre_course_task_items (section_id, task_number, sequence_index, prompt, answer)
select id, 47, 3, $pctxt$Below is a description of an activity you might use in a language learning classroom. 
Read it and describe: 
• how you would arrange the classroom to carry out the activity (position of desks, chairs, students and 
teacher) 
• what resources you could use to make the activity more effective (pictures, real objects, handouts, music, 
etc.) 
• any problems about the organisation of the activity that you could anticipate. 
Information gap role play 
Half of the students will play the role of assistants working at an information desk. They will have information 
about a range of computer courses at different prices and with different numbers of hours and different times. 
The rest of the students will be given the task of finding the most suitable course for the character they have 
been given. The students have 20 minutes to ask the assistants about their courses and agree a transaction. 

 
Dealing with language 

When you deal with language in the classroom, you will deal with meaning, form and pronunciation. Learners 
often have difficulty understanding the core meaning of new words and structures. You will need to be able to 
make the meaning clear. It is important to avoid long explanations, as this can confuse learners, who are then 
trying to process your explanation as well as understand the particular language area they are having difficulty 
with. If possible, you should demonstrate meaning by using visuals, making comparisons and contrasts, getting 
them to deduce from examples and, in general, giving the language a context (through situations and 
examples). 

When learners encounter difficulties with pronunciation, there may be different reasons. They may be unable 
to discriminate between similar sounds or stress patterns (the part of a word or sentence with more emphasis 
when spoken). Strategies for helping students include: showing them how a sound is produced, repetition of 
the sound, comparing similar sounds and practising discrimination, beating out stress by clapping, showing 
stress visually by highlighting what is stressed.$pctxt$, $pctxt$There are many different ways of organising the classroom for this activity. One possibility is for the 
learners who are the assistants at the information desks to be standing behind a desk. The learners who 
are finding out about courses move from one information officer to another information officer to find out 
the information they need. 

You could use pictures of computers to introduce the topic and to get ideas about the topic from the 
learners. The learners who are finding out about the different courses could all have different role cards 
given to them with a person described. They would then find information suitable for the person they 
have been given during the role play activity. Background music might encourage quieter learners to 
participate with more confidence. 

Learners might be reluctant to move around the classroom. Learners may not have sufficient information 
to conduct the role play. They will need to be given time to read the role cards and the information 
provided on the different computer courses. The learners may perform the role play at different speeds, 
some finishing before others.$pctxt$
from public.pre_course_task_sections where source = 'cambridge' and sequence_index = 5;

insert into public.pre_course_task_items (section_id, task_number, sequence_index, prompt, answer)
select id, 48, 4, $pctxt$You notice that your students have been confusing certain areas of language. You decide to have a lesson 
focusing on these different areas. Describe how you would make the differences clear to your students. Try to 
avoid long explanations and use as many different ways as possible (pictures, stories, diagrams, miming, etc). 

• Different meanings 
1. Slim / thin 
2. To wink / to blink 
3. I used to get up early / I am used to getting up early 
4. Nervous / upset 
5. 4 weeks ago / 4 weeks before 

• Different pronunciation 
6. I do it / I’ll do it 
7. Read (present tense) / read (past tense) 
8. Put / putt 
9. Record (noun) / record (verb) 
10. Live (verb) / live (something happening now) 
B Developing skills 

Your learners will also be developing the skills of reading and listening (receptive skills) and speaking and writing 
(productive skills). You will help them by using activities which practise and develop the various sub-skills (see 
section 3 for definitions). It is clearly important that the activities you provide have a task which relates to the 
skills you wish to develop. If you are developing learners’ ability to read for specific information, for example, 
they must know beforehand what information they are looking for.$pctxt$, $pctxt$There are many different ways of showing learners different meanings and helping them to correct their 
pronunciation. Here are some examples: 
1. Slim/thin - showing pictures of someone who is slim and another person who looks thin and asking 
the learners questions about which is a positive comment and which is a negative comment 
2. To wink/to blink - could be done by showing learners the difference - closing one eye and saying 
'wink' then closing both eyes and saying 'blink'. 
3. I used to get up early/I am used to getting up early - Show learners a picture of me as a child and 
discuss the things I did every day that I don't do now including 'I used to get up early', in the past every 
day. I don't do it now. Discuss some of the things I do every day in my life now, including getting up 
early. 'I am used to getting up early' - I do it now, every day, it is my present habit, I may find it difficult 
to get up late. 
4. Nervous/upset - mime. Ask learners questions about when they feel nervous and when they feel 
upset. 
5. 4 weeks ago/4 weeks before - lines on the board representing time. Show that 'four weeks ago' 
refers to a point in time before now, the point of reference is the present. With 'four weeks before' the 
point of reference is in the past and we are talking about four weeks before an event in the past. 

 ] ]Now 
Four weeks ago 

 ] ]_Past ]Now 
Four weeks before 

6. I do it/I'll do it - Show learners using my hand (each finger represents a word). I do it - point to three 
fingers in turn. I'll do it - point to four fingers in turn and show that 'I' and 'will' go together to make 'I'll'. 
7. Read (present tense)/read (past tense) - show the different phonemes /  / for read and /  / for read. 
8. Put/putt - show learners the shape of the mouth and lips with each. Show the different phonemes /  / 
for put and /  / for putt. 
9. Record (noun)/record (verb). Use my hands to beat the stress or write the words on the board showing 
the different stresses marked above the appropriate syllable. 
10. Live (verb)/Live (something happening now) Show learners the shape of the mouth when saying these 
two vowel sounds - closed for live (verb) with lips stretched, and open for live (something happening now). 
Show the different phonemes /  / for live (verb) and /  / for live (something happening now).$pctxt$
from public.pre_course_task_sections where source = 'cambridge' and sequence_index = 5;

insert into public.pre_course_task_items (section_id, task_number, sequence_index, prompt, answer)
select id, 49, 5, $pctxt$Below are descriptions of two activities used by teachers. In 1 the teacher was trying to develop students’ 
reading skills; in 2 the teacher was trying to develop the students’ speaking skills. Neither activity was very 
successful. Read the descriptions and: 
• explain why you think the activities were not very successful in developing the students’ reading/speaking 
skills 
• describe two activities (one for reading, one for speaking) that you think would develop those skills. 

Reading 
The teacher explained that the text was about looking after the environment. The text was handed out and each 
student was asked in turn to read parts of the text aloud. They were all able to do this. Then the teacher asked 
some questions about the content of the text. Only one or two students were able to give an answer. One 
student said that he hadn’t understood anything in the text and most of the other students agreed. 

Speaking 
The teacher wrote the topic “Living in the city” on the board and said this would be the topic of today’s 
discussion. The class were asked to give their opinions. One student said he didn’t like living in the city and 
another student said he did. These two students had a brief discussion while the other students listened. The 
teacher asked some of the other students their opinion, but none responded with more than the fact that they 
agreed/disagreed. The teacher decided to abandon the discussion. The students said they would be happy to 
write something about it for homework. 

 
C Professionalism 

As a teacher you have a range of responsibilities not always clearly related to teaching and learning. You are 
required to comply with your school/college’s requirements and these may range from the lesson plan format 
you use to a dress code! You will also be responsible for ensuring that you uphold the school/college’s 
equal 
opportunities policy, so that all learners have equal access to learning. 

Once you have completed the course, there are numerous opportunities for you to continue to train and 
develop as a teacher. The English Language Teaching profession has a number of professional organisations, 
which operate worldwide. There are also higher-level qualifications which you can do once you have gained 
more experience. These include 
ICELT (in-Service Certificate in English Language Teaching ) and Delta (Diploma 
in English Language Teaching to Adults), also offered by Cambridge English.$pctxt$, $pctxt$2. Speaking 

It is difficult for teachers to provide equal opportunities for learners to speak in an open class situation; 
confident speakers tend to dominate open class discussions. Learners often find it difficult to come up 
with ideas and opinions 'on the spot'. They need time to prepare and may need some input to get them 
thinking. Pairs or small-group discussions provide more learners with a chance to speak and are less 
intimidating for less confident learners. 

Activities for developing speaking skills: 
• Provide some stimulus for the discussion. For example: statements on the topic which learners have 
to discuss and say their opinions in small groups, or a questionnaire which asks learners to find out 
the views of their classmates. 
• Allow students time to formulate their ideas and opinions before taking part in the discussion. 
• Make sure that students have the vocabulary and the language needed to take part in the discussion.$pctxt$
from public.pre_course_task_sections where source = 'cambridge' and sequence_index = 5;

insert into public.pre_course_task_items (section_id, task_number, sequence_index, prompt, answer)
select id, 50, 6, $pctxt$Consider how the following form part of a teacher’s professionalism: 

• confidentiality • setting standards • punctuality 
• course planning/review • record keeping • assessment 
• curriculum development • pastoral care • team work 
• relationship with students • cultural awareness • self-development 
• school/college policies and rules (including equal opportunities and health and safety) 
• membership of/contribution to professional bodies 
• ESOL/EFL and teacher training research and development world-wide$pctxt$, $pctxt$Matters relating to professionalism will be discussed during your CELTA course.$pctxt$
from public.pre_course_task_sections where source = 'cambridge' and sequence_index = 5;
