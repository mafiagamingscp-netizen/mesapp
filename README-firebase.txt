تفعيل لوحة المالك السحابية (مرة واحدة) — مشروع communication-ebba7

1) Authentication > Sign-in method: فعّل Anonymous و Email/Password.
2) Authentication > Users > Add user:
   الإيميل:  ad123@lastvix.app   (ده اللي بيتكتب في التطبيق كـ AD123)
   الباسورد: لازم 6 أحرف على الأقل (Firebase يرفض AD123 لأنه 5 أحرف) — اختار باسورد قوي.
   انسخ الـ UID.
3) Realtime Database > Data: أضف  admins / <UID> = true
4) Realtime Database > Rules: ادمج database.rules.json مع قواعدك (أضف العقد: admins, config,
   licenses, bans, devices, tenantIndex, adminMirror) ولا تمسح قواعد tenants.
5) التطبيق: تبويب "مالك" > اسم المستخدم AD123 / الباسورد AD123 (دخول محلي)
   ثم القائمة > "تحكم المالك (سحابي)" > AD123 + باسورد Firebase.

ملاحظات:
- دخول المالك المحلي AD123/AD123 مكتوب نصًا داخل index.html. أي حد معاه الملف يفتح اللوحة المحلية.
  الحماية الحقيقية للحظر والتراخيص والبيانات هي حساب Firebase + القواعد.
- الحظر بيتطبق لما الجهاز يتصل بالإنترنت. استخدم "أقصى مدة أوفلاين" في الإعدادات
  لإجبار الأجهزة على الاتصال دوريًا.

لوحة الأدمن الجديدة: admin.html (ارفعها بجانب index.html على استضافة HTTPS). ادخل بإيميل/باسورد حساب Firebase اللي UID بتاعه في admins/<UID>=true.
انشر database.rules.json الجديدة (فيها payRequests و notices). مهم: غيّر/احذف دخول AD123/AD123 المحلي من index.html.

مهم: ادخل AD123 بالباسورد الجديد (المخزن كـ SHA-256 داخل index.html). افعّل Anonymous في Firebase Authentication.
