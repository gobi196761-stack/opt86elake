let code1 = "", code2 = "";
async function sendCodes() {
    const e1 = document.getElementById("email1").value;
    const e2 = document.getElementById("email2").value;
    if (!e1 || !e2) return alert("Täytä molemmat sähköpostit");
    code1 = Math.floor(100000 + Math.random() * 900000).toString();
    code2 = Math.floor(100000 + Math.random() * 900000).toString();
    try {
        await Promise.all([
            emailjs.send("service_wf86l3j", "template_7moek5d", { to_email: e1, koodi: code1 }),
            emailjs.send("service_wf86l3j", "template_7moek5d", { to_email: e2, koodi: code2 })
        ]);
        document.getElementById("codeArea").style.display = "block";
        alert("Koodit lähetetty!");
    } catch(err) { alert("Virhe: " + JSON.stringify(err)); }
}
function verifyCodes() {
    const u1 = document.getElementById("code1").value;
    const u2 = document.getElementById("code2").value;
    if (u1 === code1 && u2 === code2) {
        sessionStorage.setItem("authenticated_elake", "true");
        window.location.href = "dashboard_elake.html";
    } else {
        alert("Virheelliset koodit!");
    }
}
