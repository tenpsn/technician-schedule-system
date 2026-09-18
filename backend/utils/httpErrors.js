// ส่ง response 500 แบบทั่วไปแทนการโชว์ error จริงเช่น DB connection error หรือ stack trace ให้ผู้ใช้เห็นตรงๆ
// เพราะ frontend เอา err.error.message ไปโชว์เป็น popup เลย รายละเอียดจริงไปอยู่ใน log จาก logger.error ที่เรียกก่อนหน้านี้แทน
const sendServerError = (res) => {
  res.status(500).json({ code: 'server_error', message: 'Something went wrong' });
};

module.exports = { sendServerError };
