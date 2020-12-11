var express = require("express");
var router = express.Router();
const axios = require("axios").default;
const axiosCookieJarSupport = require("axios-cookiejar-support").default;
const tough = require("tough-cookie");
const md5 = require("md5");
const qs = require("query-string");
const cheerio = require("cheerio");
const { parseInitialFormData, parseSelector } = require("../utils");

const loginUrl = "http://qldt.actvn.edu.vn/CMCSoft.IU.Web.Info/Login.aspx";
//const studentProfileUrl = "http://qldt.actvn.edu.vn/CMCSoft.IU.Web.Info/StudentProfileNew/HoSoSinhVien.aspx";
const scheduleUrl =
  "http://qldt.actvn.edu.vn/CMCSoft.IU.Web.Info/Reports/Form/StudentTimeTable.aspx";
const XLSX = require("xlsx");
axiosCookieJarSupport(axios);
const cookieJar = new tough.CookieJar();

axios.defaults.withCredentials = true;
axios.defaults.crossdomain = true;
axios.defaults.jar = cookieJar;

/* GET home page. */
router.get("/", function (req, res, next) {
  res.render("index", { title: "Login", notice: "" });
});

router.get("/home", function (req, res, next) {
  res.render("home", {});
});

router.post("/", async function (req, res) {
  const username = req.body.username;
  const password = req.body.password;
  // console.log(username, md5(password));

  if (!username || !password) {
    res.send("Chưa Đủ Thông Tin !")
    //res.render("index", { title: "Login" });
  }

  const config = {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) coc_coc_browser/76.0.114 Chrome/70.0.3538.114 Safari/537.36",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    withCredentials: true,
    jar: cookieJar,
  };

  try {
    let getData = await axios.get(loginUrl, config);

    let $ = cheerio.load(getData.data);

    const formData = {
      ...parseInitialFormData($),
      ...parseSelector($),
      txtUserName: username,
      txtPassword: md5(password),
      btnSubmit: "Đăng nhập",
    };

    const formDataQS = qs.stringify(formData);

    let postData = await axios.post(loginUrl, formDataQS, config);

    $ = cheerio.load(postData.data);

    const userFullName = $("#PageHeader1_lblUserFullName").text().toLowerCase();
    const wrongPass = $("#lblErrorInfo").text();

    if (
      wrongPass == "Bạn đã nhập sai tên hoặc mật khẩu!" ||
      wrongPass == "Tên đăng nhập không đúng!"
    ) {
      return res.send('Sai Tài Khoản Hoặc Mật Khẩu')
      // res.render("index", {
      //   title: "Login",
      //   notice: "Sai Tài Khoản Hoặc Mật Khẩu !",
      // });
    }

    if (userFullName == "khách") {
      return res.send("Login Lỗi !");
    }

    // return res.send("Đăng Nhập Thành Công")

    const getSchedulePage = await axios.get(scheduleUrl, config);

    $ = cheerio.load(getSchedulePage.data);

    let selector = parseSelector($);
    selector.dprTerm = 1;
    selector.dprType = "B";
    selector.btnView = "Xuất file Excel";
    selector.drpSemester = selector.drpSemester;

    let scheduleFormData = {
      ...parseInitialFormData($),
      ...selector,
    };

    const scheduleFormDataQS = qs.stringify(scheduleFormData);

    const schedulePost = await axios.post(scheduleUrl, scheduleFormDataQS, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) coc_coc_browser/76.0.114 Chrome/70.0.3538.114 Safari/537.36",
        "Content-Type": "application/x-www-form-urlencoded",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
      },
      responseType: "arraybuffer",
    });

    var workbook = XLSX.read(schedulePost.data, { type: "buffer" });
    var worksheet = workbook.Sheets[workbook.SheetNames[0]];
    var jsonData = XLSX.utils.sheet_to_json(worksheet);
    let schedule = {
        studentInfo:{

        },
        schedule:[]
    };
    console.log(jsonData);
    jsonData.forEach(function(item){
      if(item['BAN CƠ YẾU CHÍNH PHỦ']=='Sinh viên :'){
        schedule.studentInfo.displayName=item.__EMPTY_1;
        schedule.studentInfo.studentCode=item.__EMPTY_4;
      }
      else if(item['BAN CƠ YẾU CHÍNH PHỦ']==1){
        let a=item.__EMPTY_6.split('Từ')[1]
        console.log(a);
      }
    });
    console.log(schedule);
    //console.log(schedule['studentInfo']['displayName'])
    //const workSheetsFromBuffer = xlsx.parse(fs.readFileSync(`${__dirname}/myFile.xlsx`));

    //return res.end(schedulePost.data)
    return res.render("home", { data: jsonData });
  } catch (e) {
    res.send("Error: " + e);
  }
});

module.exports = router;
