/**
 * Real-time Bilingual Word Translator (مترجم بلادرنگ واژگان فارسی و انگلیسی)
 * 
 * Provides:
 * 1. Instant (0ms) offline lookup for common educational, conversational, and school words
 * 2. Morphological variations & suffix handling (e.g. plurals -s, -ها, -ان, -ات, ZWNJ)
 * 3. Server-side /api/translate proxy integration for any unseen words (immune to client CORS or censorship)
 * 4. Bidirectional translation: English -> Persian and Persian -> English
 */

// Normalized clean word key
export function normalizeWord(word: string): string {
  if (!word) return '';
  return word
    .toLowerCase()
    .replace(/^[\s.,،؛;:!?؟()"«»'\[\]{}<>*#~_—\-+=/\\|]+|[\s.,،؛;:!?؟()"«»'\[\]{}<>*#~_—\-+=/\\|]+$/g, '')
    .trim();
}

// Built-in high-frequency bidirectional dictionary
const BUILTIN_DICTIONARY: Record<string, { en: string; fa: string }> = {
  // Greetings & Courtesies
  'سلام': { en: 'Hello', fa: 'سلام' },
  'درود': { en: 'Greetings', fa: 'درود' },
  'صبح': { en: 'Morning', fa: 'صبح' },
  'بخیر': { en: 'Good', fa: 'بخیر' },
  'خوب': { en: 'Good', fa: 'خوب' },
  'عصر': { en: 'Afternoon', fa: 'عصر' },
  'شب': { en: 'Night', fa: 'شب' },
  'ممنون': { en: 'Thank you', fa: 'ممنون' },
  'تشکر': { en: 'Thanks', fa: 'تشکر' },
  'سپاس': { en: 'Thanks', fa: 'سپاس' },
  'متشکرم': { en: 'Thank you', fa: 'متشکرم' },
  'لطفا': { en: 'Please', fa: 'لطفاً' },
  'لطفاً': { en: 'Please', fa: 'لطفاً' },
  'خوش': { en: 'Welcome', fa: 'خوش' },
  'آمدید': { en: 'Came', fa: 'آمدید' },
  'خداحافظ': { en: 'Goodbye', fa: 'خداحافظ' },
  'خداحافظی': { en: 'Goodbye', fa: 'خداحافظی' },
  'ببخشید': { en: 'Excuse me', fa: 'ببخشید' },
  'معذرت': { en: 'Sorry', fa: 'معذرت' },
  'خواهش': { en: 'You are welcome', fa: 'خواهش می‌کنم' },
  'عزیز': { en: 'Dear', fa: 'عزیز' },
  'گرامی': { en: 'Dear / Respected', fa: 'گرامی' },
  'محترم': { en: 'Respected', fa: 'محترم' },
  'ارجمند': { en: 'Esteemed', fa: 'ارجمند' },
  'دوستان': { en: 'Friends', fa: 'دوستان' },
  'دوست': { en: 'Friend', fa: 'دوست' },

  // English greetings & courtesies
  'hello': { en: 'Hello', fa: 'سلام' },
  'hi': { en: 'Hi', fa: 'سلام' },
  'hey': { en: 'Hey', fa: 'سلام / هی' },
  'greetings': { en: 'Greetings', fa: 'درود' },
  'morning': { en: 'Morning', fa: 'صبح' },
  'good': { en: 'Good', fa: 'خوب' },
  'afternoon': { en: 'Afternoon', fa: 'عصر' },
  'evening': { en: 'Evening', fa: 'غروب / عصر' },
  'night': { en: 'Night', fa: 'شب' },
  'thank': { en: 'Thank', fa: 'تشکر' },
  'thanks': { en: 'Thanks', fa: 'ممنون' },
  'please': { en: 'Please', fa: 'لطفاً' },
  'welcome': { en: 'Welcome', fa: 'خوش آمدید' },
  'goodbye': { en: 'Goodbye', fa: 'خداحافظ' },
  'bye': { en: 'Bye', fa: 'خداحافظ' },
  'sorry': { en: 'Sorry', fa: 'متأسفم / ببخشید' },
  'excuse': { en: 'Excuse', fa: 'ببخشید' },
  'dear': { en: 'Dear', fa: 'عزیز / گرامی' },
  'friend': { en: 'Friend', fa: 'دوست' },
  'friends': { en: 'Friends', fa: 'دوستان' },

  // School, Roles & People
  'مدرسه': { en: 'School', fa: 'مدرسه' },
  'آموزشگاه': { en: 'School / Academy', fa: 'آموزشگاه' },
  'دبیرستان': { en: 'High School', fa: 'دبیرستان' },
  'دبستان': { en: 'Elementary School', fa: 'دبستان' },
  'دانشگاه': { en: 'University', fa: 'دانشگاه' },
  'معلم': { en: 'Teacher', fa: 'معلم' },
  'معلمان': { en: 'Teachers', fa: 'معلمان' },
  'دبیر': { en: 'Teacher', fa: 'دبیر' },
  'دبیران': { en: 'Teachers', fa: 'دبیران' },
  'آموزگار': { en: 'Teacher', fa: 'آموزگار' },
  'مدیر': { en: 'Principal', fa: 'مدیر' },
  'مدیریت': { en: 'Management', fa: 'مدیریت' },
  'معاون': { en: 'Deputy / Assistant Principal', fa: 'معاون' },
  'معاونت': { en: 'Deputy Office', fa: 'معاونت' },
  'ناظم': { en: 'Supervisor', fa: 'ناظم' },
  'مشاور': { en: 'Counselor', fa: 'مشاور' },
  'همکار': { en: 'Colleague', fa: 'همکار' },
  'همکاران': { en: 'Colleagues', fa: 'همکاران' },
  'کادر': { en: 'Staff', fa: 'کادر' },
  'پرسنل': { en: 'Staff', fa: 'پرسنل' },
  'دانش‌آموز': { en: 'Student', fa: 'دانش‌آموز' },
  'دانش‌آموزان': { en: 'Students', fa: 'دانش‌آموزان' },
  'دانش آموز': { en: 'Student', fa: 'دانش‌آموز' },
  'دانش آموزان': { en: 'Students', fa: 'دانش‌آموزان' },
  'دانش': { en: 'Knowledge', fa: 'دانش' },
  'آموزان': { en: 'Students', fa: 'آموزان' },
  'شاگرد': { en: 'Pupil / Student', fa: 'شاگرد' },
  'شاگردان': { en: 'Students', fa: 'شاگردان' },
  'کلاس': { en: 'Class', fa: 'کلاس' },
  'کلاس‌ها': { en: 'Classes', fa: 'کلاس‌ها' },
  'پایه': { en: 'Grade / Level', fa: 'پایه' },
  'رشته': { en: 'Major / Field', fa: 'رشته' },
  'اولیا': { en: 'Parents', fa: 'اولیا' },
  'والدین': { en: 'Parents', fa: 'والدین' },
  'مادر': { en: 'Mother', fa: 'مادر' },
  'پدر': { en: 'Father', fa: 'پدر' },
  'خانواده': { en: 'Family', fa: 'خانواده' },

  // English roles & people
  'school': { en: 'School', fa: 'مدرسه' },
  'schools': { en: 'Schools', fa: 'مدارس' },
  'teacher': { en: 'Teacher', fa: 'معلم' },
  'teachers': { en: 'Teachers', fa: 'معلمان' },
  'principal': { en: 'Principal', fa: 'مدیر' },
  'deputy': { en: 'Deputy', fa: 'معاون' },
  'supervisor': { en: 'Supervisor', fa: 'ناظم' },
  'counselor': { en: 'Counselor', fa: 'مشاور' },
  'colleague': { en: 'Colleague', fa: 'همکار' },
  'colleagues': { en: 'Colleagues', fa: 'همکاران' },
  'staff': { en: 'Staff', fa: 'کادر / پرسنل' },
  'student': { en: 'Student', fa: 'دانش‌آموز' },
  'students': { en: 'Students', fa: 'دانش‌آموزان' },
  'pupil': { en: 'Pupil', fa: 'دانش‌آموز' },
  'pupils': { en: 'Pupils', fa: 'دانش‌آموزان' },
  'class': { en: 'Class', fa: 'کلاس' },
  'classes': { en: 'Classes', fa: 'کلاس‌ها' },
  'classroom': { en: 'Classroom', fa: 'کلاس درس' },
  'parents': { en: 'Parents', fa: 'والدین / اولیا' },
  'parent': { en: 'Parent', fa: 'ولی' },
  'mother': { en: 'Mother', fa: 'مادر' },
  'father': { en: 'Father', fa: 'پدر' },
  'family': { en: 'Family', fa: 'خانواده' },

  // Educational Tasks, Exams & Subjects
  'امتحان': { en: 'Exam', fa: 'امتحان' },
  'امتحانات': { en: 'Exams', fa: 'امتحانات' },
  'آزمون': { en: 'Test', fa: 'آزمون' },
  'آزمون‌ها': { en: 'Tests', fa: 'آزمون‌ها' },
  'تکلیف': { en: 'Homework', fa: 'تکلیف' },
  'تکالیف': { en: 'Homework', fa: 'تکالیف' },
  'تمرین': { en: 'Exercise', fa: 'تمرین' },
  'تمرینات': { en: 'Exercises', fa: 'تمرینات' },
  'نمره': { en: 'Grade / Score', fa: 'نمره' },
  'نمرات': { en: 'Grades / Scores', fa: 'نمرات' },
  'کارنامه': { en: 'Report card', fa: 'کارنامه' },
  'کتاب': { en: 'Book', fa: 'کتاب' },
  'کتاب‌ها': { en: 'Books', fa: 'کتاب‌ها' },
  'دفتر': { en: 'Notebook', fa: 'دفتر' },
  'دفاتر': { en: 'Notebooks', fa: 'دفاتر' },
  'صفحه': { en: 'Page', fa: 'صفحه' },
  'صفحات': { en: 'Pages', fa: 'صفحات' },
  'فصل': { en: 'Chapter / Season', fa: 'فصل' },
  'درس': { en: 'Lesson', fa: 'درس' },
  'دروس': { en: 'Lessons', fa: 'دروس' },
  'ریاضی': { en: 'Math', fa: 'ریاضی' },
  'ریاضیات': { en: 'Mathematics', fa: 'ریاضیات' },
  'علوم': { en: 'Science', fa: 'علوم' },
  'فیزیک': { en: 'Physics', fa: 'فیزیک' },
  'شیمی': { en: 'Chemistry', fa: 'شیمی' },
  'زیست': { en: 'Biology', fa: 'زیست' },
  'زیست‌شناسی': { en: 'Biology', fa: 'زیست‌شناسی' },
  'ادبیات': { en: 'Literature', fa: 'ادبیات' },
  'فارسی': { en: 'Persian', fa: 'فارسی' },
  'انگلیسی': { en: 'English', fa: 'انگلیسی' },
  'زبان': { en: 'Language', fa: 'زبان' },
  'تاریخ': { en: 'History', fa: 'تاریخ' },
  'جغرافیا': { en: 'Geography', fa: 'جغرافیا' },
  'ورزش': { en: 'Sports', fa: 'ورزش' },
  'هنر': { en: 'Art', fa: 'هنر' },
  'دینی': { en: 'Religious studies', fa: 'دینی' },
  'قرآن': { en: 'Quran', fa: 'قرآن' },
  'عربی': { en: 'Arabic', fa: 'عربی' },
  'جلسه': { en: 'Meeting', fa: 'جلسه' },
  'جلسات': { en: 'Meetings', fa: 'جلسات' },
  'شورا': { en: 'Council', fa: 'شورا' },
  'شورای': { en: 'Council', fa: 'شورا' },
  'انجمن': { en: 'Association', fa: 'انجمن' },
  'بخشنامه': { en: 'Circular', fa: 'بخشنامه' },
  'اطلاعیه': { en: 'Notice / Announcement', fa: 'اطلاعیه' },
  'خبر': { en: 'News', fa: 'خبر' },
  'اخبار': { en: 'News', fa: 'اخبار' },
  'حضوری': { en: 'In-person', fa: 'حضوری' },
  'مجازی': { en: 'Virtual / Online', fa: 'مجازی' },
  'حضور': { en: 'Presence / Attendance', fa: 'حضور' },
  'غیبت': { en: 'Absence', fa: 'غیبت' },
  'حاضر': { en: 'Present', fa: 'حاضر' },
  'غایب': { en: 'Absent', fa: 'غایب' },

  // English educational subjects & terms
  'exam': { en: 'Exam', fa: 'امتحان' },
  'exams': { en: 'Exams', fa: 'امتحانات' },
  'test': { en: 'Test', fa: 'آزمون' },
  'tests': { en: 'Tests', fa: 'آزمون‌ها' },
  'quiz': { en: 'Quiz', fa: 'کوئیز / آزمونک' },
  'homework': { en: 'Homework', fa: 'تکلیف' },
  'assignment': { en: 'Assignment', fa: 'تکلیف / وظیفه' },
  'assignments': { en: 'Assignments', fa: 'تکالیف' },
  'exercise': { en: 'Exercise', fa: 'تمرین' },
  'exercises': { en: 'Exercises', fa: 'تمرینات' },
  'grade': { en: 'Grade', fa: 'نمره / پایه' },
  'grades': { en: 'Grades', fa: 'نمرات' },
  'score': { en: 'Score', fa: 'نمره / امتیاز' },
  'scores': { en: 'Scores', fa: 'نمرات' },
  'book': { en: 'Book', fa: 'کتاب' },
  'books': { en: 'Books', fa: 'کتاب‌ها' },
  'notebook': { en: 'Notebook', fa: 'دفتر' },
  'notebooks': { en: 'Notebooks', fa: 'دفاتر' },
  'page': { en: 'Page', fa: 'صفحه' },
  'pages': { en: 'Pages', fa: 'صفحات' },
  'chapter': { en: 'Chapter', fa: 'فصل' },
  'lesson': { en: 'Lesson', fa: 'درس' },
  'lessons': { en: 'Lessons', fa: 'دروس' },
  'math': { en: 'Math', fa: 'ریاضی' },
  'mathematics': { en: 'Mathematics', fa: 'ریاضیات' },
  'science': { en: 'Science', fa: 'علوم' },
  'physics': { en: 'Physics', fa: 'فیزیک' },
  'chemistry': { en: 'Chemistry', fa: 'شیمی' },
  'biology': { en: 'Biology', fa: 'زیست‌شناسی' },
  'history': { en: 'History', fa: 'تاریخ' },
  'geography': { en: 'Geography', fa: 'جغرافیا' },
  'literature': { en: 'Literature', fa: 'ادبیات' },
  'persian': { en: 'Persian', fa: 'فارسی' },
  'english': { en: 'English', fa: 'انگلیسی' },
  'language': { en: 'Language', fa: 'زبان' },
  'sports': { en: 'Sports', fa: 'ورزش' },
  'art': { en: 'Art', fa: 'هنر' },
  'meeting': { en: 'Meeting', fa: 'جلسه' },
  'meetings': { en: 'Meetings', fa: 'جلسات' },
  'council': { en: 'Council', fa: 'شورا' },
  'announcement': { en: 'Announcement', fa: 'اطلاعیه' },
  'notice': { en: 'Notice', fa: 'اطلاعیه' },
  'news': { en: 'News', fa: 'اخبار' },
  'present': { en: 'Present', fa: 'حاضر' },
  'absent': { en: 'Absent', fa: 'غایب' },
  'attendance': { en: 'Attendance', fa: 'حضور و غیاب' },

  // Time & Days
  'امروز': { en: 'Today', fa: 'امروز' },
  'فردا': { en: 'Tomorrow', fa: 'فردا' },
  'دیروز': { en: 'Yesterday', fa: 'دیروز' },
  'دیشب': { en: 'Last night', fa: 'دیشب' },
  'امشب': { en: 'Tonight', fa: 'امشب' },
  'هفته': { en: 'Week', fa: 'هفته' },
  'ماه': { en: 'Month', fa: 'ماه' },
  'سال': { en: 'Year', fa: 'سال' },
  'ساعت': { en: 'Hour / O\'clock', fa: 'ساعت' },
  'دقیقه': { en: 'Minute', fa: 'دقیقه' },
  'ثانیه': { en: 'Second', fa: 'ثانیه' },
  'زمان': { en: 'Time', fa: 'زمان' },
  'وقت': { en: 'Time', fa: 'وقت' },
  'شنبه': { en: 'Saturday', fa: 'شنبه' },
  'یکشنبه': { en: 'Sunday', fa: 'یکشنبه' },
  'دوشنبه': { en: 'Monday', fa: 'دوشنبه' },
  'سه‌شنبه': { en: 'Tuesday', fa: 'سه‌شنبه' },
  'چهارشنبه': { en: 'Wednesday', fa: 'چهارشنبه' },
  'پنج‌شنبه': { en: 'Thursday', fa: 'پنج‌شنبه' },
  'جمعه': { en: 'Friday', fa: 'جمعه' },
  'روز': { en: 'Day', fa: 'روز' },
  'روزها': { en: 'Days', fa: 'روزها' },
  'آینده': { en: 'Next / Future', fa: 'آینده' },
  'بعدی': { en: 'Next', fa: 'بعدی' },
  'قبلی': { en: 'Previous', fa: 'قبلی' },
  'گذشته': { en: 'Past', fa: 'گذشته' },
  'حالا': { en: 'Now', fa: 'حالا' },
  'اکنون': { en: 'Now', fa: 'اکنون' },
  'بعداً': { en: 'Later', fa: 'بعداً' },
  'زود': { en: 'Early / Soon', fa: 'زود' },
  'دیر': { en: 'Late', fa: 'دیر' },

  // English time & days
  'today': { en: 'Today', fa: 'امروز' },
  'tomorrow': { en: 'Tomorrow', fa: 'فردا' },
  'yesterday': { en: 'Yesterday', fa: 'دیروز' },
  'tonight': { en: 'Tonight', fa: 'امشب' },
  'week': { en: 'Week', fa: 'هفته' },
  'month': { en: 'Month', fa: 'ماه' },
  'year': { en: 'Year', fa: 'سال' },
  'hour': { en: 'Hour', fa: 'ساعت' },
  'hours': { en: 'Hours', fa: 'ساعت‌ها' },
  'minute': { en: 'Minute', fa: 'دقیقه' },
  'minutes': { en: 'Minutes', fa: 'دقیقه‌ها' },
  'second': { en: 'Second', fa: 'ثانیه / دوم' },
  'time': { en: 'Time', fa: 'زمان / وقت' },
  'saturday': { en: 'Saturday', fa: 'شنبه' },
  'sunday': { en: 'Sunday', fa: 'یکشنبه' },
  'monday': { en: 'Monday', fa: 'دوشنبه' },
  'tuesday': { en: 'Tuesday', fa: 'سه‌شنبه' },
  'wednesday': { en: 'Wednesday', fa: 'چهارشنبه' },
  'thursday': { en: 'Thursday', fa: 'پنج‌شنبه' },
  'friday': { en: 'Friday', fa: 'جمعه' },
  'day': { en: 'Day', fa: 'روز' },
  'days': { en: 'Days', fa: 'روزها' },
  'next': { en: 'Next', fa: 'بعدی / آینده' },
  'previous': { en: 'Previous', fa: 'قبلی' },
  'past': { en: 'Past', fa: 'گذشته' },
  'now': { en: 'Now', fa: 'اکنون / حالا' },
  'later': { en: 'Later', fa: 'بعداً' },
  'soon': { en: 'Soon', fa: 'به زودی' },
  'early': { en: 'Early', fa: 'زود' },
  'late': { en: 'Late', fa: 'دیر' },

  // Pronouns & Demonstratives
  'من': { en: 'I / Me', fa: 'من' },
  'تو': { en: 'You', fa: 'تو' },
  'او': { en: 'He / She', fa: 'او' },
  'وی': { en: 'He / She', fa: 'وی' },
  'ما': { en: 'We', fa: 'ما' },
  'شما': { en: 'You', fa: 'شما' },
  'آنها': { en: 'They / Those', fa: 'آنها' },
  'ایشان': { en: 'They / He / She', fa: 'ایشان' },
  'این': { en: 'This', fa: 'این' },
  'آن': { en: 'That', fa: 'آن' },
  'اینها': { en: 'These', fa: 'اینها' },
  'خود': { en: 'Self', fa: 'خود' },
  'خودم': { en: 'Myself', fa: 'خودم' },
  'خودت': { en: 'Yourself', fa: 'خودت' },
  'خودش': { en: 'Himself / Herself', fa: 'خودش' },

  // English pronouns
  'i': { en: 'I', fa: 'من' },
  'you': { en: 'You', fa: 'تو / شما' },
  'he': { en: 'He', fa: 'او' },
  'she': { en: 'She', fa: 'او' },
  'it': { en: 'It', fa: 'آن / این' },
  'we': { en: 'We', fa: 'ما' },
  'they': { en: 'They', fa: 'آنها / ایشان' },
  'me': { en: 'Me', fa: 'مرا / من' },
  'him': { en: 'Him', fa: 'او را' },
  'her': { en: 'Her', fa: 'او را / مال او' },
  'us': { en: 'Us', fa: 'ما را' },
  'them': { en: 'Them', fa: 'آنها را' },
  'my': { en: 'My', fa: 'مال من' },
  'your': { en: 'Your', fa: 'مال شما / تو' },
  'our': { en: 'Our', fa: 'مال ما' },
  'their': { en: 'Their', fa: 'مال آنها' },
  'this': { en: 'This', fa: 'این' },
  'that': { en: 'That', fa: 'آن' },
  'these': { en: 'These', fa: 'اینها' },
  'those': { en: 'Those', fa: 'آنها' },

  // Common Verbs & Actions
  'است': { en: 'Is', fa: 'است' },
  'هست': { en: 'Is', fa: 'هست' },
  'هستند': { en: 'Are', fa: 'هستند' },
  'هستم': { en: 'Am', fa: 'هستم' },
  'هستید': { en: 'Are', fa: 'هستید' },
  'نیست': { en: 'Is not', fa: 'نیست' },
  'نیستند': { en: 'Are not', fa: 'نیستند' },
  'بود': { en: 'Was', fa: 'بود' },
  'بودند': { en: 'Were', fa: 'بودند' },
  'شد': { en: 'Became / Was done', fa: 'شد' },
  'می‌شود': { en: 'Will be / Becomes', fa: 'می‌شود' },
  'میشود': { en: 'Will be / Becomes', fa: 'می‌شود' },
  'دارد': { en: 'Has', fa: 'دارد' },
  'دارند': { en: 'Have', fa: 'دارند' },
  'دارم': { en: 'I have', fa: 'دارم' },
  'دارید': { en: 'You have', fa: 'دارید' },
  'داشت': { en: 'Had', fa: 'داشت' },
  'ندارد': { en: 'Does not have', fa: 'ندارد' },
  'ندارند': { en: 'Do not have', fa: 'ندارند' },
  'ارسال': { en: 'Send / Sent', fa: 'ارسال' },
  'تحویل': { en: 'Submit / Hand in', fa: 'تحویل' },
  'دهید': { en: 'Give / Provide', fa: 'دهید' },
  'کنید': { en: 'Do', fa: 'کنید' },
  'کرد': { en: 'Did', fa: 'کرد' },
  'کردند': { en: 'Did', fa: 'کردند' },
  'بررسی': { en: 'Check / Review', fa: 'بررسی' },
  'برگزار': { en: 'Held', fa: 'برگزار' },
  'برگزاری': { en: 'Holding', fa: 'برگزاری' },
  'ثبت': { en: 'Register', fa: 'ثبت' },
  'نوشتن': { en: 'Write', fa: 'نوشتن' },
  'خواندن': { en: 'Read', fa: 'خواندن' },
  'دیدن': { en: 'See', fa: 'دیدن' },
  'گفتن': { en: 'Say', fa: 'گفتن' },
  'گفت': { en: 'Said', fa: 'گفت' },
  'آمدن': { en: 'Come', fa: 'آمدن' },
  'آمد': { en: 'Came', fa: 'آمد' },
  'رفتن': { en: 'Go', fa: 'رفتن' },
  'رفت': { en: 'Went', fa: 'رفت' },
  'شروع': { en: 'Start', fa: 'شروع' },
  'پایان': { en: 'End', fa: 'پایان' },
  'باید': { en: 'Must / Should', fa: 'باید' },
  'نباید': { en: 'Should not', fa: 'نباید' },
  'می‌تواند': { en: 'Can', fa: 'می‌تواند' },
  'میتواند': { en: 'Can', fa: 'می‌تواند' },
  'می‌توانید': { en: 'You can', fa: 'می‌توانید' },
  'میتوانید': { en: 'You can', fa: 'می‌توانید' },
  'دانستن': { en: 'Know', fa: 'دانستن' },
  'فهمیدن': { en: 'Understand', fa: 'فهمیدن' },
  'یاد': { en: 'Learn / Memory', fa: 'یاد' },
  'آموزش': { en: 'Education / Training', fa: 'آموزش' },
  'کمک': { en: 'Help', fa: 'کمک' },

  // English verbs
  'is': { en: 'Is', fa: 'است' },
  'are': { en: 'Are', fa: 'هستند' },
  'am': { en: 'Am', fa: 'هستم' },
  'was': { en: 'Was', fa: 'بود' },
  'were': { en: 'Were', fa: 'بودند' },
  'be': { en: 'Be', fa: 'بودن / باشد' },
  'been': { en: 'Been', fa: 'بوده' },
  'have': { en: 'Have', fa: 'داشتن / دارند' },
  'has': { en: 'Has', fa: 'دارد' },
  'had': { en: 'Had', fa: 'داشت' },
  'do': { en: 'Do', fa: 'انجام دادن / کردن' },
  'does': { en: 'Does', fa: 'انجام می‌دهد' },
  'did': { en: 'Did', fa: 'انجام داد / کرد' },
  'done': { en: 'Done', fa: 'انجام شد' },
  'say': { en: 'Say', fa: 'گفتن' },
  'said': { en: 'Said', fa: 'گفت' },
  'tell': { en: 'Tell', fa: 'گفتن / تعریف کردن' },
  'told': { en: 'Told', fa: 'گفت' },
  'go': { en: 'Go', fa: 'رفتن' },
  'went': { en: 'Went', fa: 'رفت' },
  'gone': { en: 'Gone', fa: 'رفته' },
  'come': { en: 'Come', fa: 'آمدن' },
  'came': { en: 'Came', fa: 'آمد' },
  'see': { en: 'See', fa: 'دیدن' },
  'saw': { en: 'Saw', fa: 'دید' },
  'seen': { en: 'Seen', fa: 'دیده' },
  'look': { en: 'Look', fa: 'نگاه کردن' },
  'write': { en: 'Write', fa: 'نوشتن' },
  'wrote': { en: 'Wrote', fa: 'نوشت' },
  'written': { en: 'Written', fa: 'نوشته شده' },
  'read': { en: 'Read', fa: 'خواندن / خواند' },
  'reading': { en: 'Reading', fa: 'خواندن' },
  'send': { en: 'Send', fa: 'ارسال کردن' },
  'sent': { en: 'Sent', fa: 'ارسال شد' },
  'submit': { en: 'Submit', fa: 'تحویل دادن / ثبت' },
  'check': { en: 'Check', fa: 'بررسی کردن' },
  'review': { en: 'Review', fa: 'بررسی / مرور' },
  'start': { en: 'Start', fa: 'شروع' },
  'end': { en: 'End', fa: 'پایان' },
  'finish': { en: 'Finish', fa: 'تمام کردن' },
  'can': { en: 'Can', fa: 'توانستن / می‌تواند' },
  'could': { en: 'Could', fa: 'توانست' },
  'will': { en: 'Will', fa: 'خواهد' },
  'would': { en: 'Would', fa: 'می‌خواست' },
  'should': { en: 'Should', fa: 'باید' },
  'must': { en: 'Must', fa: 'باید / حتماً' },
  'help': { en: 'Help', fa: 'کمک' },
  'learn': { en: 'Learn', fa: 'یاد گرفتن' },
  'teach': { en: 'Teach', fa: 'آموزش دادن' },
  'know': { en: 'Know', fa: 'دانستن' },
  'understand': { en: 'Understand', fa: 'فهمیدن' },

  // Common Adjectives, Qualities & Modifiers
  'عالی': { en: 'Great / Excellent', fa: 'عالی' },
  'بسیار': { en: 'Very / Much', fa: 'بسیار' },
  'خیلی': { en: 'Very / Much', fa: 'خیلی' },
  'زیاد': { en: 'Much / Many', fa: 'زیاد' },
  'کم': { en: 'Little / Few', fa: 'کم' },
  'بزرگ': { en: 'Big / Large', fa: 'بزرگ' },
  'کوچک': { en: 'Small', fa: 'کوچک' },
  'جدید': { en: 'New', fa: 'جدید' },
  'قدیم': { en: 'Old', fa: 'قدیم' },
  'قدیمی': { en: 'Old', fa: 'قدیمی' },
  'ساده': { en: 'Simple / Easy', fa: 'ساده' },
  'سخت': { en: 'Hard / Difficult', fa: 'سخت' },
  'مهم': { en: 'Important', fa: 'مهم' },
  'الزامی': { en: 'Mandatory', fa: 'الزامی' },
  'ضروری': { en: 'Essential / Urgent', fa: 'ضروری' },
  'فوری': { en: 'Urgent', fa: 'فوری' },
  'توجه': { en: 'Attention', fa: 'توجه' },
  'دقت': { en: 'Care / Accuracy', fa: 'دقت' },
  'موفق': { en: 'Successful', fa: 'موفق' },
  'موفقیت': { en: 'Success', fa: 'موفقیت' },
  'تلاش': { en: 'Effort', fa: 'تلاش' },
  'پیشرفت': { en: 'Progress', fa: 'پیشرفت' },
  'صحیح': { en: 'Correct / Right', fa: 'صحیح' },
  'درست': { en: 'Correct / Right', fa: 'درست' },
  'غلط': { en: 'Wrong / Incorrect', fa: 'غلط' },
  'اشتباه': { en: 'Mistake / Wrong', fa: 'اشتباه' },
  'آماده': { en: 'Ready', fa: 'آماده' },
  'کامل': { en: 'Complete / Full', fa: 'کامل' },
  'سریع': { en: 'Fast / Quick', fa: 'سریع' },
  'آرام': { en: 'Slow / Calm', fa: 'آرام' },

  // English adjectives
  'great': { en: 'Great', fa: 'عالی' },
  'excellent': { en: 'Excellent', fa: 'بسیار عالی' },
  'fine': { en: 'Fine', fa: 'خوب' },
  'bad': { en: 'Bad', fa: 'بد' },
  'new': { en: 'New', fa: 'جدید' },
  'old': { en: 'Old', fa: 'قدیمی' },
  'big': { en: 'Big', fa: 'بزرگ' },
  'small': { en: 'Small', fa: 'کوچک' },
  'easy': { en: 'Easy', fa: 'آسان / ساده' },
  'hard': { en: 'Hard', fa: 'سخت' },
  'difficult': { en: 'Difficult', fa: 'دشوار / سخت' },
  'important': { en: 'Important', fa: 'مهم' },
  'urgent': { en: 'Urgent', fa: 'فوری' },
  'ready': { en: 'Ready', fa: 'آماده' },
  'complete': { en: 'Complete', fa: 'کامل' },
  'fast': { en: 'Fast', fa: 'سریع' },
  'slow': { en: 'Slow', fa: 'آرام / کُند' },
  'right': { en: 'Right', fa: 'درست / راست' },
  'correct': { en: 'Correct', fa: 'صحیح / درست' },
  'wrong': { en: 'Wrong', fa: 'غلط / اشتباه' },
  'very': { en: 'Very', fa: 'خیلی / بسیار' },
  'much': { en: 'Much', fa: 'بسیار / زیاد' },
  'many': { en: 'Many', fa: 'بسیار / تعداد زیاد' },
  'few': { en: 'Few', fa: 'تعداد کم' },
  'little': { en: 'Little', fa: 'کم / کوچک' },
  'more': { en: 'More', fa: 'بیشتر' },
  'less': { en: 'Less', fa: 'کمتر' },
  'success': { en: 'Success', fa: 'موفقیت' },
  'successful': { en: 'Successful', fa: 'موفق' },
  'attention': { en: 'Attention', fa: 'توجه' },

  // Numbers & Quantities
  'یک': { en: 'One (1)', fa: 'یک (۱)' },
  'دو': { en: 'Two (2)', fa: 'دو (۲)' },
  'سه': { en: 'Three (3)', fa: 'سه (۳)' },
  'چهار': { en: 'Four (4)', fa: 'چهار (۴)' },
  'پنج': { en: 'Five (5)', fa: 'پنج (۵)' },
  'شش': { en: 'Six (6)', fa: 'شش (۶)' },
  'هفت': { en: 'Seven (7)', fa: 'هفت (۷)' },
  'هشت': { en: 'Eight (8)', fa: 'هشت (۸)' },
  'نه': { en: 'Nine (9)', fa: 'نه (۹)' },
  'ده': { en: 'Ten (10)', fa: 'ده (۱۰)' },
  'اول': { en: 'First', fa: 'اول' },
  'دوم': { en: 'Second', fa: 'دوم' },
  'سوم': { en: 'Third', fa: 'سوم' },
  'چهارم': { en: 'Fourth', fa: 'چهارم' },
  'پنجم': { en: 'Fifth', fa: 'پنجم' },
  'همه': { en: 'All', fa: 'همه' },
  'بعضی': { en: 'Some', fa: 'بعضی' },
  'هیچ': { en: 'None / Nothing', fa: 'هیچ' },
  'هر': { en: 'Every / Each', fa: 'هر' },

  // English numbers & quantities
  'one': { en: 'One', fa: 'یک' },
  'two': { en: 'Two', fa: 'دو' },
  'three': { en: 'Three', fa: 'سه' },
  'four': { en: 'Four', fa: 'چهار' },
  'five': { en: 'Five', fa: 'پنج' },
  'six': { en: 'Six', fa: 'شش' },
  'seven': { en: 'Seven', fa: 'هفت' },
  'eight': { en: 'Eight', fa: 'هشت' },
  'nine': { en: 'Nine', fa: 'نه' },
  'ten': { en: 'Ten', fa: 'ده' },
  'first': { en: 'First', fa: 'اول' },
  'third': { en: 'Third', fa: 'سوم' },
  'all': { en: 'All', fa: 'همه' },
  'some': { en: 'Some', fa: 'بعضی' },
  'none': { en: 'None', fa: 'هیچ' },
  'every': { en: 'Every', fa: 'هر' },
  'each': { en: 'Each', fa: 'هر کدام' },

  // Connectors, Prepositions & Questions
  'و': { en: 'And', fa: 'و' },
  'یا': { en: 'Or', fa: 'یا' },
  'اما': { en: 'But', fa: 'اما' },
  'ولی': { en: 'But', fa: 'ولی' },
  'اگر': { en: 'If', fa: 'اگر' },
  'چون': { en: 'Because / Since', fa: 'چون' },
  'زیرا': { en: 'Because', fa: 'زیرا' },
  'پس': { en: 'So / Then', fa: 'پس' },
  'بنابراین': { en: 'Therefore', fa: 'بنابراین' },
  'با': { en: 'With', fa: 'با' },
  'بدون': { en: 'Without', fa: 'بدون' },
  'برای': { en: 'For', fa: 'برای' },
  'از': { en: 'From / Of', fa: 'از' },
  'به': { en: 'To', fa: 'به' },
  'در': { en: 'In / At', fa: 'در' },
  'روی': { en: 'On', fa: 'روی' },
  'زیر': { en: 'Under', fa: 'زیر' },
  'بین': { en: 'Between', fa: 'بین' },
  'درباره': { en: 'About', fa: 'درباره' },
  'مورد': { en: 'Case / Regard', fa: 'مورد' },
  'که': { en: 'That / Which', fa: 'که' },
  'را': { en: '[Object marker]', fa: 'را' },
  'چی': { en: 'What', fa: 'چه / چی' },
  'چه': { en: 'What', fa: 'چه' },
  'چرا': { en: 'Why', fa: 'چرا' },
  'کجا': { en: 'Where', fa: 'کجا' },
  'کی': { en: 'When / Who', fa: 'کِی / چه وقت' },
  'چطور': { en: 'How', fa: 'چطور' },
  'چگونه': { en: 'How', fa: 'چگونه' },
  'کدام': { en: 'Which', fa: 'کدام' },
  'آیا': { en: 'Is / Do / Question marker', fa: 'آیا' },

  // English connectors, prepositions & questions
  'and': { en: 'And', fa: 'و' },
  'or': { en: 'Or', fa: 'یا' },
  'but': { en: 'But', fa: 'اما / ولی' },
  'if': { en: 'If', fa: 'اگر' },
  'because': { en: 'Because', fa: 'زیرا / چون' },
  'so': { en: 'So', fa: 'بنابراین / پس' },
  'then': { en: 'Then', fa: 'سپس / آنگاه' },
  'with': { en: 'With', fa: 'با' },
  'without': { en: 'Without', fa: 'بدون' },
  'for': { en: 'For', fa: 'برای' },
  'from': { en: 'From', fa: 'از' },
  'to': { en: 'To', fa: 'به' },
  'in': { en: 'In', fa: 'در' },
  'on': { en: 'On', fa: 'روی' },
  'at': { en: 'At', fa: 'در' },
  'under': { en: 'Under', fa: 'زیر' },
  'about': { en: 'About', fa: 'درباره' },
  'what': { en: 'What', fa: 'چه / چی' },
  'why': { en: 'Why', fa: 'چرا' },
  'where': { en: 'Where', fa: 'کجا' },
  'when': { en: 'When', fa: 'چه وقت / کِی' },
  'how': { en: 'How', fa: 'چطور / چگونه' },
  'which': { en: 'Which', fa: 'کدام' },
  'who': { en: 'Who', fa: 'چه کسی / کی' },
  'yes': { en: 'Yes', fa: 'بله' },
  'no': { en: 'No', fa: 'خیر / نه' },
  'ok': { en: 'OK', fa: 'باشه / خوب' },
  'okay': { en: 'Okay', fa: 'باشه' },

  // Chat & Media Terms
  'پیام': { en: 'Message', fa: 'پیام' },
  'پیام‌ها': { en: 'Messages', fa: 'پیام‌ها' },
  'متن': { en: 'Text', fa: 'متن' },
  'صدا': { en: 'Voice / Audio', fa: 'صدا' },
  'گفتار': { en: 'Speech', fa: 'گفتار' },
  'صوت': { en: 'Audio', fa: 'صوت' },
  'عکس': { en: 'Photo', fa: 'عکس' },
  'تصویر': { en: 'Image', fa: 'تصویر' },
  'ویدیو': { en: 'Video', fa: 'ویدیو' },
  'فیلم': { en: 'Film / Video', fa: 'فیلم' },
  'فایل': { en: 'File', fa: 'فایل' },
  'دانلود': { en: 'Download', fa: 'دانلود' },
  'پاسخ': { en: 'Reply / Answer', fa: 'پاسخ' },
  'جواب': { en: 'Answer', fa: 'جواب' },
  'پرسش': { en: 'Question', fa: 'پرسش' },
  'سؤال': { en: 'Question', fa: 'سؤال' },
  'سوال': { en: 'Question', fa: 'سؤال' },
  'گروه': { en: 'Group', fa: 'گروه' },
  'کانال': { en: 'Channel', fa: 'کانال' },
  'ترجمه': { en: 'Translation', fa: 'ترجمه' },
  'گوگل': { en: 'Google', fa: 'گوگل' },
  'google': { en: 'Google', fa: 'گوگل' },
  'meet': { en: 'Meet', fa: 'میت / جلسه' },
  'link': { en: 'Link', fa: 'لینک' },
  'لینک': { en: 'Link', fa: 'لینک' },

  // English chat & media
  'message': { en: 'Message', fa: 'پیام' },
  'messages': { en: 'Messages', fa: 'پیام‌ها' },
  'text': { en: 'Text', fa: 'متن' },
  'voice': { en: 'Voice', fa: 'صدا / گفتار' },
  'audio': { en: 'Audio', fa: 'صوت / صدا' },
  'speech': { en: 'Speech', fa: 'گفتار' },
  'photo': { en: 'Photo', fa: 'عکس' },
  'image': { en: 'Image', fa: 'تصویر' },
  'video': { en: 'Video', fa: 'ویدیو' },
  'file': { en: 'File', fa: 'فایل' },
  'reply': { en: 'Reply', fa: 'پاسخ' },
  'answer': { en: 'Answer', fa: 'جواب / پاسخ' },
  'question': { en: 'Question', fa: 'سؤال / پرسش' },
  'group': { en: 'Group', fa: 'گروه' },
  'channel': { en: 'Channel', fa: 'کانال' },
  'translate': { en: 'Translate', fa: 'ترجمه کردن' },
  'translation': { en: 'Translation', fa: 'ترجمه' },
};

// Dynamic in-memory LRU cache for translated words
const dynamicWordCache = new Map<string, string>();

/**
 * Synchronous instant lookup for a word
 */
export function getInstantWordTranslation(word: string, isEnglish: boolean): string | null {
  const clean = normalizeWord(word);
  if (!clean) return null;

  // 1. Direct dictionary match
  const found = BUILTIN_DICTIONARY[clean];
  if (found) {
    return isEnglish ? found.fa : found.en;
  }

  // 2. Dynamic memory cache
  const cacheKey = `${isEnglish ? 'en:fa' : 'fa:en'}:${clean}`;
  if (dynamicWordCache.has(cacheKey)) {
    return dynamicWordCache.get(cacheKey)!;
  }

  // 3. Persian morphological & suffix variations (for Persian words)
  if (!isEnglish) {
    // Variations without zero-width non-joiner (\u200C)
    const withoutZwnj = clean.replace(/\u200C/g, '');
    const withSpace = clean.replace(/\u200C/g, ' ');
    if (BUILTIN_DICTIONARY[withoutZwnj]) return BUILTIN_DICTIONARY[withoutZwnj].en;
    if (BUILTIN_DICTIONARY[withSpace]) return BUILTIN_DICTIONARY[withSpace].en;

    // Plural suffixes: -ها، -های، -ان، -ات
    if (clean.endsWith('‌ها') && clean.length > 3) {
      const root = clean.slice(0, -3);
      if (BUILTIN_DICTIONARY[root]) return `${BUILTIN_DICTIONARY[root].en}s`;
    }
    if (clean.endsWith('ها') && clean.length > 3) {
      const root = clean.slice(0, -2);
      if (BUILTIN_DICTIONARY[root]) return `${BUILTIN_DICTIONARY[root].en}s`;
    }
    if (clean.endsWith('ان') && clean.length > 3) {
      const root = clean.slice(0, -2);
      if (BUILTIN_DICTIONARY[root]) return `${BUILTIN_DICTIONARY[root].en}s`;
    }
    if (clean.endsWith('ات') && clean.length > 3) {
      const root = clean.slice(0, -2);
      if (BUILTIN_DICTIONARY[root]) return `${BUILTIN_DICTIONARY[root].en}s`;
    }
    // Prefix: می‌- or نمی-
    if ((clean.startsWith('می‌') || clean.startsWith('میش')) && clean.length > 4) {
      const root = clean.replace(/^می‌?/, '');
      if (BUILTIN_DICTIONARY[root]) return BUILTIN_DICTIONARY[root].en;
    }
  }

  // 4. English morphological variations (for English words)
  if (isEnglish) {
    // Plural -s or -es
    if (clean.endsWith('s') && clean.length > 3) {
      const root = clean.endsWith('es') ? clean.slice(0, -2) : clean.slice(0, -1);
      if (BUILTIN_DICTIONARY[root]) return BUILTIN_DICTIONARY[root].fa;
    }
    // Past tense -ed
    if (clean.endsWith('ed') && clean.length > 4) {
      const root = clean.endsWith('ied') ? `${clean.slice(0, -3)}y` : clean.slice(0, -2);
      if (BUILTIN_DICTIONARY[root]) return BUILTIN_DICTIONARY[root].fa;
    }
    // Gerund -ing
    if (clean.endsWith('ing') && clean.length > 5) {
      const root = clean.slice(0, -3);
      if (BUILTIN_DICTIONARY[root]) return BUILTIN_DICTIONARY[root].fa;
      if (BUILTIN_DICTIONARY[`${root}e`]) return BUILTIN_DICTIONARY[`${root}e`].fa;
    }
  }

  return null;
}

/**
 * Asynchronous translation for a word with instant fallback and caching.
 * Uses local /api/translate endpoint first for maximum speed and zero CORS/network blocking.
 */
export async function translateSingleWord(word: string, isEnglish: boolean): Promise<string> {
  const clean = normalizeWord(word);
  if (!clean) return '';

  // 1. Instant lookup
  const instant = getInstantWordTranslation(word, isEnglish);
  if (instant) return instant;

  const targetLang = isEnglish ? 'fa' : 'en';
  const sourceLang = isEnglish ? 'en' : 'fa';
  const cacheKey = `${sourceLang}:${targetLang}:${clean}`;

  if (dynamicWordCache.has(cacheKey)) {
    return dynamicWordCache.get(cacheKey)!;
  }

  try {
    // 2. Query server-side proxy route /api/translate (runs on Node server, immune to client CORS/VPN)
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: clean, targetLang, sourceLang }),
      signal: AbortSignal.timeout(2500),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.translatedText) {
        const trans = data.translatedText.trim();
        if (trans && trans.toLowerCase() !== clean.toLowerCase()) {
          dynamicWordCache.set(cacheKey, trans);
          return trans;
        }
      }
    }
  } catch {
    // ignore
  }

  try {
    // 3. Fallback to client-side Google GTX if available
    const gtxUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(clean)}`;
    const res = await fetch(gtxUrl, { signal: AbortSignal.timeout(1500) });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json) && Array.isArray(json[0]) && json[0][0] && json[0][0][0]) {
        const trans = json[0][0][0].trim();
        if (trans && trans.toLowerCase() !== clean.toLowerCase()) {
          dynamicWordCache.set(cacheKey, trans);
          return trans;
        }
      }
    }
  } catch {
    // ignore
  }

  return '';
}

/**
 * Pre-warm the translation cache for all words in a message
 * so that when the word is spoken a moment later, its translation is already available!
 */
export function prefetchMessageWordTranslations(text: string, isEnglish: boolean): void {
  if (!text) return;
  const words = text.split(/\s+/).filter(Boolean);
  const uniqueWords = Array.from(new Set(words.map(normalizeWord))).filter(Boolean);

  // Background non-blocking warm-up for words not yet in dictionary
  uniqueWords.slice(0, 50).forEach((w) => {
    const isWordLatin = /[a-zA-Z]/.test(w);
    const wordIsEnglish = isWordLatin || (isEnglish && !/[\u0600-\u06FF]/.test(w));
    const instant = getInstantWordTranslation(w, wordIsEnglish);
    if (!instant) {
      translateSingleWord(w, wordIsEnglish).catch(() => {});
    }
  });
}
