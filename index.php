<?php
/* V27.7.2 Customer Portal bridge — additive; existing SBC site remains unchanged. */
if (isset($_GET['sbc_portal'])) {
    $action=(string)$_GET['sbc_portal'];
    $routes=[
      'profile'=>['GET','/api/portal/profile'],
      'services'=>['GET','/api/portal/services'],
      'orders'=>['GET','/api/portal/orders'],
      'messages'=>['GET','/api/portal/messages'],
      'login'=>['POST','/api/portal/login'],
      'register'=>['POST','/api/portal/register'],
      'logout'=>['POST','/api/portal/logout'],
      'send_message'=>['POST','/api/portal/messages']
    ];
    if(!isset($routes[$action])){http_response_code(404);header('Content-Type: application/json');echo json_encode(['ok'=>false,'error'=>'Unknown SBC portal action.']);exit;}
    [$method,$path]=$routes[$action];
    $base='https://app-sbcmia.c24.airoapp.ai';
    $ch=curl_init(rtrim($base,'/').$path);
    $headers=['Accept: application/json'];
    $opts=[CURLOPT_RETURNTRANSFER=>true,CURLOPT_FOLLOWLOCATION=>true,CURLOPT_CONNECTTIMEOUT=>8,CURLOPT_TIMEOUT=>25,CURLOPT_CUSTOMREQUEST=>$method];
    /* Do not forward unrelated browser cookies to the Command Center. */
    $portalToken=(string)($_COOKIE['sbc_portal_token']??'');
    if($portalToken)$headers[]='Authorization: Bearer '.$portalToken;
    if($method==='POST'){
      $raw=file_get_contents('php://input');
      $headers[]='Content-Type: application/json';
      $opts[CURLOPT_POSTFIELDS]=$raw?:'{}';
    }
    $opts[CURLOPT_HTTPHEADER]=$headers;curl_setopt_array($ch,$opts);
    $raw=curl_exec($ch);$code=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);$err=curl_error($ch);curl_close($ch);
    if($raw===false||$err){http_response_code(502);header('Content-Type: application/json');echo json_encode(['ok'=>false,'error'=>'SBC Command Center is not reachable right now.']);exit;}
    // The customer portal token belongs to the sbcmia.com bridge cookie, not the SBC app domain.
    // Login/register returns the signed token; capture it here and reuse it for subsequent API calls.
    $decoded=null; if(in_array($action,['login','register'],true)){ $decoded=json_decode($raw,true); if(is_array($decoded)&&!empty($decoded['token'])){setcookie('sbc_portal_token',(string)$decoded['token'],['expires'=>time()+2592000,'path'=>'/','secure'=>true,'httponly'=>true,'samesite'=>'Lax']); } }
    if($action==='logout'){setcookie('sbc_portal_token','',['expires'=>time()-3600,'path'=>'/','secure'=>true,'httponly'=>true,'samesite'=>'Lax']);}
    http_response_code($code?:200);header('Content-Type: application/json');header('Cache-Control: no-store');echo $raw;exit;
}
?>

<?php
/* SBC lightweight form handler: keeps customer questionnaires on-site instead of relying on mailto:. */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['sbc_form'])) {
    header('Content-Type: application/json; charset=utf-8');
    $form = (string)$_POST['sbc_form'];
    $honeypot = trim((string)($_POST['website'] ?? ''));
    if ($honeypot !== '') { echo json_encode(['ok' => true, 'message' => 'Thanks!']); exit; }

    $clean = function($value) {
        return trim(strip_tags((string)$value));
    };
    /* V27.8 public-site → Command Center lead bridge. CRM becomes the system of record; email remains a notification fallback. */
    $sbc_crm_lead = function(array $lead) {
        $endpoint = 'https://app-sbcmia.c24.airoapp.ai/api/web-lead';
        $payload = json_encode($lead, JSON_UNESCAPED_SLASHES);
        if (!function_exists('curl_init') || $payload === false) return ['ok'=>false,'error'=>'CRM bridge unavailable on this PHP host.'];
        $ch = curl_init($endpoint);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_POSTFIELDS => $payload,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json','Accept: application/json','Origin: https://sbcmia.com'],
            CURLOPT_CONNECTTIMEOUT => 6, CURLOPT_TIMEOUT => 15
        ]);
        $raw = curl_exec($ch); $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); $err = curl_error($ch); curl_close($ch);
        $json = json_decode((string)$raw, true);
        return ['ok'=>!$err && $code>=200 && $code<300, 'code'=>$code, 'data'=>$json, 'error'=>$err ?: (($json['error'] ?? '') ?: '')];
    };
    $emailTo = 'j@sbcmia.com';
    $subject = '';
    $body = '';
    $headers = "From: SBC Website <j@sbcmia.com>\r\nReply-To: j@sbcmia.com\r\n";

    if ($form === 'card') {
        $business = $clean($_POST['business'] ?? '');
        $name = $clean($_POST['name'] ?? '');
        $phone = $clean($_POST['phone'] ?? '');
        $qty = $clean($_POST['qty'] ?? '');
        $colors = $clean($_POST['colors'] ?? '');
        $style = $clean($_POST['style'] ?? '');
        $details = $clean($_POST['details'] ?? '');
        $notes = $clean($_POST['notes'] ?? '');
        if ($business === '' || $name === '') {
            echo json_encode(['ok' => false, 'message' => 'Please enter the business name and your name.']); exit;
        }
        $crm = $sbc_crm_lead([
            'businessName'=>$business,'contactName'=>$name,'phone'=>$phone,'serviceInterest'=>'Business Cards',
            'quoteType'=>'Business Card Design Brief','quantity'=>$qty,'message'=>"Colors: $colors\nStyle: $style\nCard details: $details\nNotes: $notes",
            'sourcePage'=>'https://sbcmia.com/#card-questionnaire'
        ]);
        $subject = 'Business Card Design Brief - ' . $business;
        $body = "SBC BUSINESS CARD DESIGN BRIEF\n\nBusiness: $business\nName: $name\nPhone: $phone\nQuantity: $qty\nColors: $colors\nStyle: $style\nCard details: $details\nNotes: $notes\nCRM: " . ($crm['ok']?'Created/updated lead':'Bridge unavailable — email notification only') . "\n";
    } elseif ($form === 'sign') {
        $name = $clean($_POST['name'] ?? '');
        $business = $clean($_POST['business'] ?? '');
        $signType = $clean($_POST['sign_type'] ?? '');
        $size = $clean($_POST['size'] ?? '');
        $details = $clean($_POST['details'] ?? '');
        if ($name === '' || $signType === '' || $details === '') {
            echo json_encode(['ok' => false, 'message' => 'Please complete the required sign details.']); exit;
        }
        $crm = $sbc_crm_lead([
            'businessName'=>$business,'contactName'=>$name,'serviceInterest'=>'LED & Neon Signs',
            'quoteType'=>'Sign Request','message'=>"Sign type: $signType\nApprox. size: $size\nDetails: $details",
            'sourcePage'=>'https://sbcmia.com/#led-neon'
        ]);
        $subject = 'New LED / Neon Sign Request' . ($business ? ' - ' . $business : '');
        $body = "SBC LED / NEON SIGN REQUEST\n\nName: $name\nBusiness: $business\nWhat they are looking for: $signType\nApprox. size: $size\nDetails: $details\nCRM: " . ($crm['ok']?'Created/updated lead':'Bridge unavailable — email notification only') . "\n";

        $file = $_FILES['design'] ?? null;
        if ($file && isset($file['error']) && $file['error'] !== UPLOAD_ERR_NO_FILE) {
            if ($file['error'] !== UPLOAD_ERR_OK || $file['size'] > 8 * 1024 * 1024) {
                echo json_encode(['ok' => false, 'message' => 'The uploaded file must be under 8 MB.']); exit;
            }
            $allowed = ['image/jpeg','image/png','image/gif','image/webp','application/pdf'];
            $finfo = function_exists('finfo_open') ? finfo_open(FILEINFO_MIME_TYPE) : false;
            $mime = $finfo ? finfo_file($finfo, $file['tmp_name']) : $file['type'];
            if ($finfo) finfo_close($finfo);
            if (!in_array($mime, $allowed, true)) {
                echo json_encode(['ok' => false, 'message' => 'Please upload a JPG, PNG, GIF, WEBP, or PDF file.']); exit;
            }
            $filename = preg_replace('/[^A-Za-z0-9._-]/', '_', basename($file['name']));
            $attachment = chunk_split(base64_encode(file_get_contents($file['tmp_name'])));
            $boundary = 'SBC_' . md5(uniqid('', true));
            $headers .= "MIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary=\"$boundary\"\r\n";
            $message = "--$boundary\r\nContent-Type: text/plain; charset=\"UTF-8\"\r\n\r\n$body\r\n";
            $message .= "--$boundary\r\nContent-Type: $mime; name=\"$filename\"\r\nContent-Disposition: attachment; filename=\"$filename\"\r\nContent-Transfer-Encoding: base64\r\n\r\n$attachment\r\n--$boundary--\r\n";
            $sent = function_exists('mail') ? @mail($emailTo, $subject, $message, $headers) : false;
        } else {
            $sent = function_exists('mail') ? @mail($emailTo, $subject, $body, $headers) : false;
        }
        echo json_encode(['ok' => $sent || !empty($crm['ok']), 'crmLead' => !empty($crm['ok']), 'message' => ($sent || !empty($crm['ok'])) ? 'Your sign request was sent to SBC. We will follow up with you.' : 'We could not send the request from the website right now. Please call 305-496-1065 or email j@sbcmia.com.']); exit;
    } else {
        echo json_encode(['ok' => false, 'message' => 'Invalid form request.']); exit;
    }

    $sent = function_exists('mail') ? @mail($emailTo, $subject, $body, $headers) : false;
    echo json_encode(['ok' => $sent || !empty($crm['ok']), 'crmLead' => !empty($crm['ok']), 'message' => ($sent || !empty($crm['ok'])) ? 'Your design brief was sent to SBC.' : 'We could not send the brief from the website right now. Please call 305-496-1065 or email j@sbcmia.com.']);
    exit;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
 <meta charset="UTF-8" />
 <meta name="viewport" content="width=device-width, initial-scale=1.0" />
 <meta name="description" content="Successful By Choice helps businesses build a professional presence from one place — Google Business Profiles, social media setup, websites, hosting, domains, business email, printing, signage, notary services and more." />
 <meta name="theme-color" content="#0f172a" />
 <link rel="canonical" href="https://sbcmia.com/" />
 <title>Successful By Choice | One Place for Your Business Solutions</title>

 <!-- Font Awesome: corrected CDN -->
 <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" crossorigin="anonymous" referrerpolicy="no-referrer" />

 <style>
 :root {
 --navy: #0f172a;
 --navy-2: #172033;
 --orange: #f97316;
 --orange-dark: #ea580c;
 --blue: #2563eb;
 --green: #10b981;
 --ink: #172033;
 --muted: #64748b;
 --line: #e2e8f0;
 --soft: #f8fafc;
 --white: #ffffff;
 --shadow: 0 18px 45px rgba(15, 23, 42, .10);
 --shadow-soft: 0 8px 30px rgba(15, 23, 42, .07);
 --radius: 20px;
 --max: 1180px;
 }

 * { box-sizing: border-box; margin: 0; padding: 0; }
 html { scroll-behavior: smooth; }
 body {
 font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
 background: var(--soft);
 color: var(--ink);
 line-height: 1.6;
 }
 a { color: inherit; text-decoration: none; }
 img { max-width: 100%; display: block; }
 button, input, select, textarea { font: inherit; }
 .container { width: min(var(--max), calc(100% - 36px)); margin: 0 auto; }
 .section { padding: 84px 0; }
 .eyebrow {
 display: inline-flex;
 align-items: center;
 gap: 9px;
 padding: 8px 12px;
 border-radius: 999px;
 font-size: 11px;
 font-weight: 800;
 letter-spacing: .13em;
 text-transform: uppercase;
 color: var(--orange-dark);
 background: #fff7ed;
 border: 1px solid #fed7aa;
 }
 .section-heading { max-width: 760px; margin: 0 auto 46px; text-align: center; }
 .section-heading h2 { font-size: clamp(30px, 5vw, 46px); line-height: 1.08; margin: 14px 0; letter-spacing: -.035em; }
 .section-heading p { color: var(--muted); font-size: 17px; }

 /* Top bar */
 .utility {
 background: var(--navy);
 color: #cbd5e1;
 font-size: 12px;
 border-bottom: 1px solid rgba(255,255,255,.08);
 }
 .utility-inner { min-height: 38px; display: flex; justify-content: space-between; align-items: center; gap: 16px; }
 .utility span, .utility a { display: inline-flex; align-items: center; gap: 7px; }
 .utility i { color: var(--orange); }

 /* Nav */
 .nav-wrap { position: sticky; top: 0; z-index: 50; background: rgba(255,255,255,.94); backdrop-filter: blur(14px); border-bottom: 1px solid rgba(226,232,240,.9); }
 .nav { min-height: 76px; display: flex; align-items: center; justify-content: space-between; gap: 22px; }
 .brand { display: flex; align-items: center; min-width: max-content; }
 .brand-logo { width: 235px; height: 62px; object-fit: contain; object-position: left center; border-radius: 8px; background: #05080d; padding: 3px 8px; box-shadow: 0 4px 16px rgba(15,23,42,.08); }
 .brand-title, .brand-sub { display: none; }
 .nav-links { display: flex; align-items: center; gap: 24px; color: #475569; font-weight: 700; font-size: 14px; }
 .nav-links a:hover { color: var(--orange-dark); }
 .nav-cta { display: inline-flex; align-items: center; gap: 8px; background: var(--navy); color: white; padding: 11px 16px; border-radius: 11px; font-weight: 800; font-size: 13px; box-shadow: 0 8px 20px rgba(15,23,42,.14); }
 .nav-cta:hover { background: #1e293b; }
 .mobile-menu-btn { display:none; border:1px solid var(--line); background:white; color:var(--navy); width:44px; height:44px; border-radius:11px; cursor:pointer; align-items:center; justify-content:center; font-size:18px; }
 .mobile-nav { display:none; border-top:1px solid var(--line); background:white; }
 .mobile-nav-inner { display:grid; gap:4px; padding:12px 0 16px; }
 .mobile-nav a { padding:12px 10px; border-radius:10px; color:#475569; font-weight:800; }
 .mobile-nav a:hover { background:#f8fafc; color:var(--orange-dark); }
 .mobile-nav.open { display:block; }

 /* Hero */
 .hero { position: relative; overflow: hidden; background: linear-gradient(135deg, #0f172a 0%, #111c33 60%, #18263b 100%); color: white; padding: 96px 0 104px; }
 .hero::before { content: ""; position: absolute; inset: 0; opacity: .35; background-image: radial-gradient(circle at 1px 1px, rgba(255,255,255,.16) 1px, transparent 0); background-size: 28px 28px; }
 .hero::after { content: ""; position: absolute; width: 520px; height: 520px; border-radius: 50%; top: -260px; right: -220px; background: rgba(249,115,22,.17); filter: blur(12px); }
 .hero-grid { position: relative; z-index: 2; display: grid; grid-template-columns: 1.15fr .85fr; gap: 50px; align-items: center; }
 .hero .eyebrow { background: rgba(255,255,255,.06); color: #fdba74; border-color: rgba(249,115,22,.3); }
 .hero h1 { font-size: clamp(42px, 6vw, 70px); line-height: .99; letter-spacing: -.055em; margin: 22px 0; }
 .hero h1 span { color: #fb923c; }
 .hero-copy { max-width: 720px; color: #cbd5e1; font-size: 18px; }
 .hero-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 30px; }
 .btn { display: inline-flex; align-items: center; justify-content: center; gap: 9px; border-radius: 12px; padding: 14px 20px; font-weight: 850; border: 1px solid transparent; transition: .2s ease; }
 .btn-orange { background: var(--orange); color: white; box-shadow: 0 14px 30px rgba(249,115,22,.25); }
 .btn-orange:hover { background: var(--orange-dark); transform: translateY(-1px); }
 .btn-light { background: rgba(255,255,255,.07); color: white; border-color: rgba(255,255,255,.12); }
 .btn-light:hover { background: rgba(255,255,255,.12); }
 .hero-proof { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; margin-top: 36px; }
 .proof { background: rgba(255,255,255,.055); border: 1px solid rgba(255,255,255,.09); padding: 15px; border-radius: 15px; }
 .proof strong { display: block; font-size: 20px; }
 .proof span { color: #94a3b8; font-size: 11px; }
 .proof-link { cursor:pointer; transition:.2s ease; }
 .proof-link:hover { background:rgba(255,255,255,.10); border-color:rgba(249,115,22,.35); transform:translateY(-2px); }
 .proof-link strong i { font-size:10px; color:#fb923c; margin-left:4px; }
 .info-badge { position:relative; cursor:help; outline:none; }
 .info-badge::after { content:attr(data-tip); position:absolute; left:50%; bottom:calc(100% + 10px); transform:translate(-50%, 5px); width:min(250px, calc(100vw - 70px)); padding:10px 12px; border-radius:10px; background:#020617; color:#fff; font-size:11px; line-height:1.45; text-align:left; box-shadow:0 12px 30px rgba(0,0,0,.25); opacity:0; visibility:hidden; pointer-events:none; transition:.18s ease; z-index:10; }
 .info-badge::before { content:""; position:absolute; left:50%; bottom:calc(100% + 4px); transform:translate(-50%, 5px); border:6px solid transparent; border-top-color:#020617; opacity:0; visibility:hidden; transition:.18s ease; z-index:11; }
 .info-badge:hover::after, .info-badge:hover::before, .info-badge:focus-visible::after, .info-badge:focus-visible::before { opacity:1; visibility:visible; transform:translate(-50%,0); }
 .info-badge:focus-visible { box-shadow:0 0 0 3px rgba(249,115,22,.35); }
 .questionnaire { margin-top:24px; padding:20px; border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.05); border-radius:16px; }
 .questionnaire h4 { font-size:16px; margin-bottom:6px; }
 .questionnaire p { font-size:12px; margin-bottom:13px; }
 .questionnaire .btn { padding:10px 13px; font-size:12px; }

 .hero-card { background: rgba(255,255,255,.96); color: var(--ink); border-radius: 24px; padding: 26px; box-shadow: 0 30px 70px rgba(0,0,0,.25); border: 1px solid rgba(255,255,255,.15); }
 .hero-card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 22px; }
 .hero-card-top h3 { font-size: 18px; }
 .status { color: #047857; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 6px 9px; border-radius: 999px; font-weight: 800; font-size: 10px; text-transform: uppercase; }
 .mini-stack { display: grid; gap: 10px; }
 .mini-line { display:flex; align-items:center; justify-content:space-between; border:1px solid var(--line); padding: 13px 14px; border-radius: 13px; }
 .mini-left { display:flex; align-items:center; gap: 11px; }
 .mini-icon { width: 34px; height: 34px; border-radius: 10px; display:grid; place-items:center; background:#f8fafc; color:var(--orange); }
 .mini-line strong { font-size: 13px; }
 .mini-line small { display:block; color:var(--muted); font-size:10px; }
 .check { color:#059669; }
 .hero-card-foot { border-top: 1px solid var(--line); margin-top: 18px; padding-top: 16px; color:var(--muted); font-size: 12px; }

 /* Service grid */
 .services { background: white; }
 .service-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
 .card { background: white; border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow-soft); }
 .service-card { padding: 27px; transition: .22s ease; }
 .service-card:hover { transform: translateY(-4px); box-shadow: var(--shadow); }

 .neon-section { background: linear-gradient(135deg, #fff7ed 0%, #ffffff 55%, #f8fafc 100%); }
 .neon-card { display:grid; grid-template-columns:1.05fr .95fr; gap:30px; align-items:center; padding:34px; background:var(--navy); color:white; border-radius:24px; overflow:hidden; position:relative; box-shadow:var(--shadow); }
 .neon-card::after { content:""; position:absolute; width:330px; height:330px; right:-120px; top:-130px; border-radius:50%; background:rgba(249,115,22,.18); filter:blur(8px); }
 .neon-copy { position:relative; z-index:2; }
 .neon-copy h3 { font-size:clamp(30px,4vw,44px); line-height:1.05; letter-spacing:-.04em; margin:14px 0; }
 .neon-copy p { color:#cbd5e1; max-width:620px; }
 .neon-points { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:22px 0; }
 .neon-point { border:1px solid rgba(255,255,255,.10); background:rgba(255,255,255,.05); border-radius:13px; padding:14px; color:white; transition:.2s ease; }
 .neon-point:hover { background:rgba(255,255,255,.09); border-color:rgba(249,115,22,.35); transform:translateY(-2px); }
 .neon-point strong { display:block; font-size:13px; margin-bottom:3px; }
 .neon-point span { display:block; color:#94a3b8; font-size:11px; line-height:1.45; }
 .neon-point i { color:#fb923c; margin-right:7px; }
 .neon-form { margin-top:22px; padding:18px; border:1px solid rgba(255,255,255,.11); background:rgba(255,255,255,.045); border-radius:16px; }
 .neon-form h4 { font-size:15px; margin-bottom:5px; }
 .neon-form p { font-size:11px; color:#94a3b8; margin-bottom:12px; }
 .neon-form-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
 .neon-form input, .neon-form textarea { width:100%; border:1px solid rgba(255,255,255,.14); background:rgba(2,6,23,.35); color:white; border-radius:10px; padding:10px 11px; font-size:12px; }
 .neon-form input::placeholder, .neon-form textarea::placeholder { color:#94a3b8; }
 .neon-form textarea { min-height:90px; resize:vertical; grid-column:1/-1; }
 .neon-form input:focus, .neon-form textarea:focus { outline:3px solid rgba(249,115,22,.18); border-color:#fb923c; }
 .neon-form .btn { margin-top:10px; width:100%; }
 .neon-visual { position:relative; z-index:2; min-height:310px; display:grid; place-items:center; border:1px solid rgba(255,255,255,.10); border-radius:20px; background:radial-gradient(circle at center, rgba(249,115,22,.12), rgba(2,6,23,.45) 60%); }
 .neon-word { color:#fff; font-size:clamp(42px,7vw,76px); font-weight:900; letter-spacing:.04em; text-shadow:0 0 8px rgba(255,255,255,.8), 0 0 22px rgba(249,115,22,.75), 0 0 48px rgba(249,115,22,.45); transform:rotate(-2deg); }
 .neon-small { margin-top:8px; color:#fdba74; font-size:11px; text-transform:uppercase; letter-spacing:.16em; font-weight:900; }
 .neon-file-note { font-size:10px !important; color:#64748b !important; margin:7px 0 0 !important; }
 .service-icon { width: 50px; height: 50px; border-radius: 14px; display:grid; place-items:center; color:white; font-size:19px; margin-bottom:19px; }
 .orange { background: var(--orange); } .navy { background: var(--navy); } .blue { background: var(--blue); } .green { background: var(--green); }
 .service-card h3 { margin-bottom: 9px; font-size: 20px; letter-spacing: -.02em; }
 .service-card p { color: var(--muted); font-size: 14px; }
 .service-list { list-style:none; margin-top: 17px; border-top: 1px solid var(--line); padding-top: 15px; display:grid; gap: 8px; }
 .service-list li { color:#475569; font-size:12px; display:flex; gap:8px; align-items:flex-start; }
 .service-list i { color:var(--green); margin-top:3px; }

 /* Pricing */
 .pricing { background: #f8fafc; }
 .price-grid { display:grid; grid-template-columns: repeat(5, 1fr); gap: 14px; align-items: stretch; }
 .price-card { position:relative; display:flex; flex-direction:column; padding: 24px 20px; background:white; border:1px solid var(--line); border-radius:19px; box-shadow:var(--shadow-soft); }
 .price-card.popular { border:2px solid var(--orange); transform: translateY(-8px); box-shadow: 0 24px 55px rgba(249,115,22,.17); }
 .popular-tag { position:absolute; top:-14px; left:50%; transform:translateX(-50%); white-space:nowrap; background:var(--orange); color:white; padding:6px 11px; border-radius:999px; font-size:10px; font-weight:900; letter-spacing:.08em; text-transform:uppercase; }
 .price-card h3 { font-size:19px; margin-bottom:5px; }
 .price-card .desc { color:var(--muted); font-size:12px; min-height:42px; }
 .price-card.featured { border:2px solid var(--orange); box-shadow: 0 24px 55px rgba(249,115,22,.17); transform: translateY(-8px); }
 .price { font-size: 32px; font-weight: 950; letter-spacing: -.04em; margin: 16px 0 2px; }
 .price small { font-size: 12px; font-weight: 700; color: var(--muted); letter-spacing: 0; }
 .value { color:#047857; font-size:11px; font-weight:800; margin-bottom:14px; }
 .price-list { list-style:none; display:grid; gap:9px; margin: 10px 0 20px; flex:1; }
 .price-list li { font-size:12px; color:#475569; display:flex; gap:8px; }
 .price-list i { color:var(--green); margin-top:3px; font-size:11px; }
 .price-btn { width:100%; margin-top:auto; }
 .pricing-note { margin: 30px auto 0; max-width: 850px; text-align:center; color: var(--muted); font-size: 12px; }
 .economics { margin-top:32px; display:grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
 .econ { background:white; border:1px dashed #cbd5e1; border-radius:14px; padding:15px; }
 .econ strong { display:block; font-size:15px; }
 .econ span { font-size:11px; color:var(--muted); }

 /* Print */
 .print { background:white; }
 .print-layout { display:grid; grid-template-columns: .8fr 1.2fr; gap: 40px; align-items:start; }
 .print-panel { background: linear-gradient(135deg, #0f172a, #1e293b); color:white; border-radius:24px; padding:30px; min-height: 100%; }
 .print-panel h3 { font-size:30px; line-height:1.08; letter-spacing:-.04em; margin:16px 0; }
 .print-panel p { color:#cbd5e1; font-size:14px; }
 .print-badges { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:24px; }
 .print-badge { border:1px solid rgba(255,255,255,.1); background:rgba(255,255,255,.05); border-radius:13px; padding:12px; font-size:12px; }
 .print-table { overflow:hidden; border:1px solid var(--line); border-radius:18px; }
 .print-row { display:grid; grid-template-columns: 1.15fr .55fr .9fr .65fr; padding:16px 18px; gap:12px; align-items:center; }
 .print-row:not(:last-child) { border-bottom:1px solid var(--line); }
 .print-row.header { background:#f8fafc; color:#475569; font-size:11px; font-weight:900; text-transform:uppercase; letter-spacing:.08em; }
 .print-row strong { font-size:14px; }
 .print-row span { color:var(--muted); font-size:12px; }
 .print-row .price-cell { color:var(--ink); font-weight:900; font-size:15px; }
 .print-row .btn { padding:9px 12px; font-size:12px; white-space:nowrap; }
 .questionnaire label, #card-questionnaire label { display:block; font-size:13px; font-weight:800; color:var(--ink); }
 #card-questionnaire input, #card-questionnaire select, #card-questionnaire textarea { width:100%; margin-top:6px; padding:12px; border:1px solid var(--line); border-radius:10px; background:#fff; color:var(--ink); }
 #card-questionnaire input:focus, #card-questionnaire select:focus, #card-questionnaire textarea:focus { outline:3px solid rgba(37,99,235,.15); border-color:#93c5fd; }
 .full-question { margin-top:16px; }

 /* Process */
 .process { background:#f8fafc; }
 .process-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; }
 .step { padding:23px; }
 .step-num { width:38px; height:38px; display:grid; place-items:center; border-radius:11px; background:#fff7ed; color:var(--orange-dark); font-weight:950; margin-bottom:15px; }
 .step h3 { font-size:17px; margin-bottom:7px; }
 .step p { color:var(--muted); font-size:13px; }

 /* FAQ & CTA */
 .faq-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
 details { background:white; border:1px solid var(--line); border-radius:14px; padding:17px 18px; }
 details[open] { border-color:#fdba74; }
 summary { cursor:pointer; font-weight:850; font-size:14px; list-style:none; }
 summary::-webkit-details-marker { display:none; }
 details p { color:var(--muted); font-size:13px; padding-top:11px; }
 .cta { background:var(--navy); color:white; border-radius:28px; padding:45px; display:flex; justify-content:space-between; align-items:center; gap:30px; }
 .cta h2 { font-size:clamp(28px,4vw,42px); line-height:1.05; letter-spacing:-.04em; }
 .cta p { color:#94a3b8; margin-top:10px; max-width:700px; }
 .cta-actions { display:flex; flex-wrap:wrap; gap:10px; min-width:max-content; }

 footer { background:#08101d; color:white; padding:46px 0 24px; }
 .footer-grid { display:grid; grid-template-columns:1.5fr 1fr 1fr; gap:40px; }
 footer p, footer a { color:#94a3b8; font-size:13px; }
 footer a:hover { color:white; }
 .footer-links { display:grid; gap:8px; }
 .footer-title { color:white; font-weight:900; margin-bottom:9px; }
 .footer-bottom { border-top:1px solid rgba(255,255,255,.08); margin-top:34px; padding-top:19px; display:flex; justify-content:space-between; gap:20px; font-size:11px; color:#64748b; }

 @media (max-width: 1050px) {
 .nav-links, .nav-cta { display:none; }
 .mobile-menu-btn { display:inline-flex; }
 .hero-grid, .print-layout, .neon-card { grid-template-columns:1fr; }
 .hero-card { max-width:650px; }
 .price-grid { grid-template-columns: repeat(2,1fr); }
 .price-card.popular { transform:none; }
 .service-grid { grid-template-columns: repeat(2,1fr); }
 .process-grid { grid-template-columns: repeat(2,1fr); }
 }
 @media (max-width: 720px) {
 .utility-inner { justify-content:center; flex-wrap:wrap; padding:8px 0; }
 .section { padding:64px 0; }
 .hero { padding:70px 0 74px; }
 .hero h1 { font-size:46px; }
 .hero-proof { grid-template-columns:1fr; }
 .service-grid, .price-grid, .process-grid, .faq-grid, .economics { grid-template-columns:1fr; }
 .print-badges, .neon-points { grid-template-columns:1fr; }
 .print-row { grid-template-columns:1fr; }
 .print-row.header { display:none; }
 .print-row .btn { width:100%; margin-top:4px; }
 .question-grid { grid-template-columns:1fr !important; }
 .cta { padding:30px; flex-direction:column; align-items:flex-start; }
 .cta-actions { min-width:0; }
 .footer-grid { grid-template-columns:1fr; gap:26px; }
 .footer-bottom { flex-direction:column; }
 }
 
 /* Version B — positioning, proof, trust and premium polish */
 .hero-copy strong { color: var(--navy); }
 .hero-note {
   display:flex; align-items:center; gap:10px; margin-top:16px;
   color:#475569; font-size:12px; font-weight:700;
 }
 .hero-note i { color:var(--orange); }
 .section-kicker {
   display:flex; flex-wrap:wrap; gap:8px; justify-content:center; margin:0 auto 22px;
 }
 .section-kicker span {
   padding:7px 10px; border:1px solid var(--line); border-radius:999px;
   background:#fff; color:#475569; font-size:11px; font-weight:800;
 }
 .difference {
   background:linear-gradient(180deg,#fff 0%,#f8fafc 100%);
 }
 .difference-grid { display:grid; grid-template-columns:1.1fr .9fr; gap:28px; align-items:stretch; }
 .difference-panel, .story-panel {
   background:#fff; border:1px solid var(--line); border-radius:24px; box-shadow:var(--shadow-soft);
   padding:32px;
 }
 .difference-panel h3, .story-panel h3 { font-size:28px; line-height:1.15; letter-spacing:-.025em; margin-bottom:12px; }
 .difference-panel > p, .story-panel > p { color:var(--muted); }
 .difference-points { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-top:22px; }
 .difference-point { border:1px solid var(--line); border-radius:16px; padding:18px; background:#fff; }
 .difference-point i { color:var(--orange); font-size:18px; margin-bottom:9px; }
 .difference-point strong { display:block; margin-bottom:4px; }
 .difference-point span { display:block; color:var(--muted); font-size:13px; }
 .face-card {
   background:var(--navy); color:#fff; border-radius:24px; padding:32px; position:relative; overflow:hidden;
 }
 .face-card:after {
   content:""; position:absolute; width:180px; height:180px; border-radius:50%;
   border:1px solid rgba(255,255,255,.12); right:-70px; top:-70px;
 }
 .face-card .eyebrow { background:rgba(249,115,22,.12); color:#fdba74; border-color:rgba(249,115,22,.3); }
 .face-card h3 { font-size:30px; line-height:1.1; margin:16px 0 12px; letter-spacing:-.03em; }
 .face-card p { color:#cbd5e1; }
 .face-card .quote {
   margin-top:22px; padding-top:18px; border-top:1px solid rgba(255,255,255,.1);
   font-size:15px; font-weight:800; color:#fff;
 }
 .service-group-label {
   display:flex; align-items:center; gap:10px; margin:34px 0 16px;
   font-size:13px; font-weight:900; letter-spacing:.08em; text-transform:uppercase; color:#475569;
 }
 .service-group-label:after { content:""; height:1px; background:var(--line); flex:1; }
 .service-group-label i { color:var(--orange); }
 .proof-section { background:var(--navy); color:#fff; }
 .proof-section .section-heading p { color:#cbd5e1; }
 .proof-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; }
 .proof-card { border:1px solid rgba(255,255,255,.11); border-radius:20px; padding:24px; background:rgba(255,255,255,.04); }
 .proof-card .proof-num { font-size:30px; font-weight:900; letter-spacing:-.04em; color:#fff; }
 .proof-card h3 { margin:7px 0 5px; }
 .proof-card p { color:#cbd5e1; font-size:13px; }
 .founder { background:#f8fafc; }
 .founder-grid { display:grid; grid-template-columns:.8fr 1.2fr; gap:28px; align-items:stretch; }
 .founder-card {
   background:var(--navy); color:#fff; border-radius:24px; padding:32px; display:flex; flex-direction:column; justify-content:space-between;
 }
 .founder-mark {
   width:64px; height:64px; border-radius:18px; display:grid; place-items:center;
   background:var(--orange); color:#fff; font-weight:1000; font-size:20px; margin-bottom:20px;
 }
 .founder-card h3 { font-size:32px; line-height:1.08; letter-spacing:-.03em; }
 .founder-card p { color:#cbd5e1; margin-top:12px; }
 .founder-sign { margin-top:28px; font-weight:900; }
 .founder-sign span { display:block; color:#94a3b8; font-size:11px; font-weight:700; margin-top:3px; }
 .founder-copy { background:#fff; border:1px solid var(--line); border-radius:24px; padding:32px; }
 .founder-copy h2 { font-size:clamp(30px,5vw,46px); line-height:1.05; letter-spacing:-.04em; margin:12px 0 16px; }
 .founder-copy p { color:var(--muted); margin-bottom:14px; }
 .beliefs { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:22px; }
 .belief { padding:16px; border:1px solid var(--line); border-radius:16px; }
 .belief strong { display:block; margin-bottom:4px; }
 .belief span { color:var(--muted); font-size:12px; }
 .future-banner {
   margin-top:28px; padding:20px; border-radius:18px; background:#fff7ed; border:1px solid #fed7aa;
 }
 .future-banner strong { display:block; color:#9a3412; margin-bottom:4px; }
 .future-banner span { color:#7c2d12; font-size:13px; }
 .notary-card { position:relative; }
 .coming-soon {
   display:inline-flex; margin-bottom:10px; padding:5px 8px; border-radius:999px;
   background:#fff7ed; color:#9a3412; border:1px solid #fed7aa; font-size:10px; font-weight:900; text-transform:uppercase;
 }
 .footer-tagline { margin-top:10px; color:#94a3b8 !important; font-size:12px !important; }
 @media (max-width: 900px) {
   .difference-grid,.founder-grid { grid-template-columns:1fr; }
   .proof-grid { grid-template-columns:1fr 1fr; }
 }
 @media (max-width: 640px) {
   .difference-points,.beliefs,.proof-grid { grid-template-columns:1fr; }
   .difference-panel,.story-panel,.face-card,.founder-card,.founder-copy { padding:24px; }
   .hero-note { align-items:flex-start; }
 }

 /* V30 FINAL — mobile/touch hardening; visual layout preserved */
@media (max-width: 640px){body{overflow-x:hidden;-webkit-text-size-adjust:100%}.container{width:min(100% - 24px,1180px)}.hero h1{font-size:clamp(34px,11vw,46px)}.hero p{font-size:15px}.section{padding:54px 0}.price-card,.service-card,.difference-panel,.story-panel,.face-card,.founder-card,.founder-copy{border-radius:18px}.btn,.nav-cta,input,select,textarea,button{min-height:44px}input,select,textarea{font-size:16px!important}.price-card .btn,.cta-actions .btn,.print-row .btn{width:100%}.print-row{gap:8px}.neon-form-grid,.question-grid{grid-template-columns:1fr!important}.footer-grid{grid-template-columns:1fr}.sbc-mobile-account-button{width:100%}}
</style>

<style id="sbc-v27-portal-css">
#sbc-v27-portal-backdrop{position:fixed;inset:0;background:rgba(2,6,23,.62);z-index:9998;display:none;align-items:center;justify-content:center;padding:18px}
#sbc-v27-portal-backdrop.open{display:flex}
#sbc-v27-portal{width:min(560px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:22px;box-shadow:0 30px 90px rgba(0,0,0,.35);border:1px solid #e2e8f0}
#sbc-v27-portal .phead{background:#0f172a;color:#fff;padding:20px 22px;display:flex;justify-content:space-between;align-items:center}
#sbc-v27-portal .phead strong{font-size:18px}
#sbc-v27-portal .pbody{padding:22px}
#sbc-v27-portal .tabs{display:flex;gap:8px;margin-bottom:18px}
#sbc-v27-portal .tabs button{flex:1;padding:10px;border:1px solid #dbe3ed;background:#f8fafc;border-radius:10px;font-weight:800;cursor:pointer}
#sbc-v27-portal .tabs button.active{background:#f97316;color:#fff;border-color:#f97316}
#sbc-v27-portal label{display:block;font-weight:800;font-size:13px;margin:11px 0 5px}
#sbc-v27-portal input,#sbc-v27-portal textarea{width:100%;padding:11px;border:1px solid #cbd5e1;border-radius:9px}
#sbc-v27-portal .pmsg{padding:10px 12px;border-radius:9px;margin-bottom:12px;background:#eff6ff;color:#1e3a8a}
#sbc-v27-portal .pmsg.err{background:#fff1f2;color:#9f1239}
#sbc-v27-portal .pmsg.ok{background:#ecfdf5;color:#065f46}
#sbc-v27-portal .account-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:14px 0}
#sbc-v27-portal .account-card{border:1px solid #e2e8f0;border-radius:14px;padding:15px}
#sbc-v27-portal .account-card h4{margin:0 0 5px}
#sbc-v27-portal .account-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:15px}
#sbc-v27-portal .x{background:transparent;color:#fff;font-size:25px;cursor:pointer}
@media(max-width:600px){#sbc-v27-portal .account-grid{grid-template-columns:1fr}}
</style>

</head>
<body id="top">

   <div class="utility">
     <div class="container utility-inner">
 <span><i class="fa-solid fa-location-dot"></i> Miami, Florida</span>
 <span><i class="fa-solid fa-phone"></i> <a href="tel:3054961065">305-496-1065</a></span>
 </div>
 </div>

 <div class="nav-wrap">
 <div class="container nav">
 <a class="brand" href="#top" aria-label="Successful By Choice home">
 <img class="brand-logo" src="data:image/png;base64,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" alt="Successful By Choice — Because Why Not?" />
 </a>

 <nav class="nav-links" aria-label="Primary navigation">
        <button id="sbc-account-button" type="button" class="nav-cta" onclick="SBCPortal.open()">
          <i class="fa-solid fa-user"></i> My SBC Account
        </button>
 <a href="#services">Services</a>
 <a href="#pricing">Packages</a>
 <a href="#print">Printing</a>
 <a href="#neon-signs">LED & Neon</a>
   <a href="#faq">FAQ</a>
 <a href="https://sbcwebsites.com" target="_blank" rel="noopener"><i class="fa-solid fa-globe"></i> SBC Websites</a>
 </nav>

 <a class="nav-cta" href="tel:3054961065"><i class="fa-solid fa-phone"></i> Talk to SBC</a>
 <button class="mobile-menu-btn" id="mobileMenuBtn" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="mobileNav"><i class="fa-solid fa-bars"></i></button>
 </div>
 <button id="sbc-mobile-account-button" type="button" class="btn btn-orange" style="margin:10px 0 14px;width:100%;" onclick="SBCPortal.open()"><i class="fa-solid fa-user"></i> My SBC Account</button>\n<div class="mobile-nav" id="mobileNav">
 <div class="container mobile-nav-inner">
 <a href="#services">Services</a>
 <a href="#pricing">Packages</a>
 <a href="#print">Printing & Cards</a>
  <a href="#faq">FAQ</a>
 <a href="https://sbcwebsites.com" target="_blank" rel="noopener"><i class="fa-solid fa-globe"></i> SBC Websites</a>
 <a href="tel:3054961065"><i class="fa-solid fa-phone"></i> Talk to SBC</a>
 </div>
 </div>
 </div>

 <main>
 <section class="hero">
 <div class="container hero-grid">
 <div>
 <span class="eyebrow"><i class="fa-solid fa-bolt"></i> Built for small & growing businesses</span>
 <h1>Get your business <span>online, branded & ready to grow.</span></h1>
 <p class="hero-copy"><strong>Build your business. Build it right.</strong><br>
Successful By Choice makes it easier to build a professional business presence without piecing everything together yourself — Google Business Profiles, social media, websites, domains, hosting, business email, printing, signage, notary services and more.</p>
<div class="hero-note"><i class="fa-solid fa-user"></i><span>One place. Multiple solutions. A real person behind the solution.</span></div>

 <div class="hero-actions">
 <a class="btn btn-orange" href="#pricing"><i class="fa-solid fa-layer-group"></i> See the $99 / $199 / $349 / $699 Packages</a>
 <a class="btn btn-light" href="https://sbcwebsites.com" target="_blank" rel="noopener"><i class="fa-solid fa-globe"></i> Visit SBC Websites</a>
 </div>

 <div class="hero-proof" aria-label="SBC service shortcuts">
 <a class="proof proof-link" href="https://sbcwebsites.com" target="_blank" rel="noopener" aria-label="Web services — visit SBC Websites"><strong>Web <i class="fa-solid fa-arrow-up-right-from-square"></i></strong><span>Design + hosting + domains</span></a>
 <a class="proof proof-link" href="#print" aria-label="Print services — view printing section"><strong>Print <i class="fa-solid fa-arrow-down"></i></strong><span>Cards + marketing materials</span></a>
 <a class="proof proof-link" href="tel:3054961065" aria-label="Support — call Successful By Choice"><strong>Support <i class="fa-solid fa-phone"></i></strong><span>One local business contact</span></a>
 </div>
 </div>

 <div class="hero-card">
 <div class="hero-card-top">
 <h3>Your business launch stack</h3>
 <span class="status"><i class="fa-solid fa-circle"></i> Ready to build</span>
 </div>
 <div class="mini-stack">
 <div class="mini-line"><div class="mini-left"><div class="mini-icon"><i class="fa-solid fa-globe"></i></div><div><strong>Business Domain</strong><small>Your professional web address</small></div></div><i class="fa-solid fa-check check"></i></div>
 <div class="mini-line"><div class="mini-left"><div class="mini-icon"><i class="fa-solid fa-server"></i></div><div><strong>Web Hosting</strong><small>Reliable website infrastructure</small></div></div><i class="fa-solid fa-check check"></i></div>
 <div class="mini-line"><div class="mini-left"><div class="mini-icon"><i class="fa-solid fa-laptop-code"></i></div><div><strong>Professional Website</strong><small>Mobile-friendly business presence</small></div></div><i class="fa-solid fa-check check"></i></div>
 <div class="mini-line"><div class="mini-left"><div class="mini-icon"><i class="fa-solid fa-address-card"></i></div><div><strong>Business Cards</strong><small>Designed and ordered for you</small></div></div><i class="fa-solid fa-check check"></i></div>
 </div>
 <div class="hero-card-foot"><i class="fa-solid fa-circle-info"></i> Packages bundle services so you can spend less time managing vendors and more time running your business.</div>
 </div>
 </div>
 </section>

 <section class="section" style="padding:26px 0 0;background:var(--soft);">
 <div class="container">
 <div style="display:flex;align-items:center;justify-content:space-between;gap:20px;padding:18px 20px;border:1px solid #bfdbfe;background:#eff6ff;border-radius:16px;">
 <div>
 <strong style="display:block;color:var(--navy);font-size:15px;">Looking for websites, hosting or domains?</strong>
 <span style="color:#475569;font-size:13px;">SBC Websites is the dedicated web & hosting division of Successful By Choice.</span>
 </div>
 <a class="btn btn-orange" href="https://sbcwebsites.com" target="_blank" rel="noopener" style="white-space:nowrap;padding:11px 16px;"><i class="fa-solid fa-arrow-up-right-from-square"></i> Visit SBC Websites</a>
 </div>
 </div>
 </section>

 <section id="why-sbc" class="section difference">
  <div class="container">
   <div class="section-heading">
    <span class="eyebrow">The SBC difference</span>
    <h2>More than a vendor. A partner you can talk to.</h2>
    <p>Business owners shouldn't have to chase five different companies to build a professional presence. SBC brings the pieces together and gives you one point of contact.</p>
   </div>
   <div class="difference-grid">
    <div class="difference-panel">
     <h3>Built around convenience.</h3>
     <p>Start with one service or let SBC handle more of the setup. The goal is simple: make it easier to get your business where it needs to be.</p>
     <div class="difference-points">
      <div class="difference-point"><i class="fa-solid fa-user"></i><strong>A real person</strong><span>You can call, ask questions and work through the details with someone who knows your project.</span></div>
      <div class="difference-point"><i class="fa-solid fa-puzzle-piece"></i><strong>Connected solutions</strong><span>Your website, cards, email, hosting and signage can work together instead of feeling like separate purchases.</span></div>
      <div class="difference-point"><i class="fa-solid fa-store"></i><strong>Local presence</strong><span>SBC has a physical business presence in the Miami area, not just an online checkout page.</span></div>
      <div class="difference-point"><i class="fa-solid fa-arrow-trend-up"></i><strong>Built to grow</strong><span>Start where you are today and add services as your business becomes more established.</span></div>
     </div>
    </div>
    <div class="face-card">
     <span class="eyebrow">Because Why Not?</span>
     <h3>Put a face to the solution.</h3>
     <p>Technology should make business easier — not make business owners feel like they're on their own. SBC is being built around personal service, practical solutions and long-term relationships.</p>
     <div class="quote">“You don't have to know exactly what you need before you call. Start the conversation and we'll figure out the next step together.”</div>
    </div>
   </div>
  </div>
 </section>

 <section class="section" style="padding-top:24px;padding-bottom:24px;background:#fff;">
  <div class="container">
   <div style="display:flex;gap:14px;align-items:center;justify-content:center;flex-wrap:wrap;text-align:center;">
    <span class="eyebrow">The SBC approach</span>
    <strong style="font-size:18px;letter-spacing:-.02em;">Built for where your business is today. Designed for where you're going tomorrow.</strong>
   </div>
  </div>
 </section>

 <section id="services" class="section services">
 <div class="container">
 <div class="section-heading">
 <span class="eyebrow">What we do</span>
 <h2>Everything your business needs to look established.</h2>
 <p>From getting found on Google and social media to the website, business card or hosting plan you need next, SBC brings the pieces together under one business brand.</p>
 </div>

 <div class="service-group-label"><i class="fa-solid fa-globe"></i> Build your digital presence</div>
 <div class="service-grid">
 <article class="card service-card">
 <div class="service-icon orange"><i class="fa-solid fa-location-dot"></i></div>
 <h3>Google Business & Local Visibility</h3>
 <p>Get your business information organized and presented professionally where local customers search.</p>
 <ul class="service-list"><li><i class="fa-solid fa-check"></i> Google Business Profile setup or cleanup</li><li><i class="fa-solid fa-check"></i> Business information & services</li><li><i class="fa-solid fa-check"></i> Review link and profile guidance</li></ul>
 </article>
 <article class="card service-card">
 <div class="service-icon navy"><i class="fa-solid fa-laptop-code"></i></div>
 <h3>Website Design</h3>
 <p>Professional, responsive websites designed around your business, services and customers.</p>
 <ul class="service-list"><li><i class="fa-solid fa-check"></i> Mobile-friendly layouts</li><li><i class="fa-solid fa-check"></i> Business-focused pages</li><li><i class="fa-solid fa-check"></i> Deployment & updates</li></ul>
 </article>
 <article class="card service-card">
 <div class="service-icon orange"><i class="fa-solid fa-server"></i></div>
 <h3>Domains & Hosting</h3>
 <p>Keep your website, domain and hosting organized through one provider relationship.</p>
 <ul class="service-list"><li><i class="fa-solid fa-check"></i> Domain registration</li><li><i class="fa-solid fa-check"></i> cPanel hosting options</li><li><i class="fa-solid fa-check"></i> SSL/security options</li></ul>
 </article>
 <article class="card service-card">
 <div class="service-icon blue"><i class="fa-solid fa-address-card"></i></div>
 <h3>Business Cards</h3>
 <p>Clean, professional cards that match your brand and give customers a reason to remember you.</p>
 <ul class="service-list"><li><i class="fa-solid fa-check"></i> Design assistance</li><li><i class="fa-solid fa-check"></i> Multiple quantities</li><li><i class="fa-solid fa-check"></i> Professional print sourcing</li></ul>
 </article>
 </div>
 <div class="service-group-label"><i class="fa-solid fa-bullhorn"></i> Build your brand & visibility</div>
 <div class="service-grid">
 <article class="card service-card">
 <div class="service-icon blue"><i class="fa-brands fa-instagram"></i></div>
 <h3>Social Media Setup</h3>
 <p>Set up or clean up the social profiles customers use to discover and connect with your business.</p>
 <ul class="service-list"><li><i class="fa-solid fa-check"></i> Up to 2 business profiles</li><li><i class="fa-solid fa-check"></i> Bio, contact & business info</li><li><i class="fa-solid fa-check"></i> Consistent branding setup</li></ul>
 </article>
 <article class="card service-card">
 <div class="service-icon green"><i class="fa-solid fa-bullhorn"></i></div>
 <h3>Marketing Materials</h3>
 <p>Flyers, menus, signs and other branded materials that keep your message consistent.</p>
 <ul class="service-list"><li><i class="fa-solid fa-check"></i> Flyers & menus</li><li><i class="fa-solid fa-check"></i> Signs & promotional pieces</li><li><i class="fa-solid fa-check"></i> Brand-ready files</li></ul>
 </article>
 </div>
 <div class="service-group-label"><i class="fa-solid fa-handshake"></i> Keep the business moving</div>
 <div class="service-grid">
 <article class="card service-card">
 <div class="service-icon navy"><i class="fa-solid fa-envelope"></i></div>
 <h3>Business Email</h3>
 <p>Professional domain-based email helps customers recognize your business communication.</p>
 <ul class="service-list"><li><i class="fa-solid fa-check"></i> Custom business address</li><li><i class="fa-solid fa-check"></i> Mailbox setup options</li><li><i class="fa-solid fa-check"></i> Account configuration</li></ul>
 </article>
 <article class="card service-card notary-card">
 <span class="coming-soon">Launching soon</span>
 <div class="service-icon blue"><i class="fa-solid fa-file-signature"></i></div>
 <h3>Notary Services</h3>
 <p>Convenient notarization services designed to give local customers another reason to make SBC their first stop.</p>
 <ul class="service-list"><li><i class="fa-solid fa-check"></i> Local service</li><li><i class="fa-solid fa-check"></i> Appointment-friendly</li><li><i class="fa-solid fa-check"></i> Practical document support</li></ul>
 </article>
 <article class="card service-card">
 <div class="service-icon orange"><i class="fa-solid fa-screwdriver-wrench"></i></div>
 <h3>Business Support</h3>
 <p>Need something connected, updated or cleaned up? SBC can help with the digital side of the operation.</p>
 <ul class="service-list"><li><i class="fa-solid fa-check"></i> Site edits</li><li><i class="fa-solid fa-check"></i> Hosting assistance</li><li><i class="fa-solid fa-check"></i> Print reorders</li></ul>
 </article>
 </div>
 </div>
 </section>

 <section id="pricing" class="section pricing">
 <div class="container">
  <div class="section-heading">
   <span class="eyebrow">SBC business packages</span>
   <h2>Choose the package that fits your business. Then let’s build.</h2>
   <p>Three straightforward options make it easier to get the business essentials you need without sorting through a long list of separate services.</p>
  </div>

  <div class="sales-callout">
   <strong>Start simple. Upgrade when your business needs more.</strong>
   <span>Every package is designed around a real business need. If you are not sure which one fits, call SBC and we’ll help you choose.</span>
  </div>

  <div class="price-grid" style="grid-template-columns:repeat(4,1fr);max-width:1200px;margin:0 auto;">
   <article class="price-card popular">
    <span class="popular-tag">Best Fallback Offer</span>
    <span class="package-badge"><i class="fa-solid fa-location-dot"></i> Visibility</span>
    <h3>Business Visibility</h3>
    <p class="desc">For businesses that want to look professional and get found online without paying for a website yet.</p>
    <div class="price">$99 <small>setup</small></div>
    <div class="value">Get visible. Start professional.</div>
    <ul class="price-list">
     <li><i class="fa-solid fa-check"></i> Google Business Profile setup or cleanup</li>
     <li><i class="fa-solid fa-check"></i> Business information, services & hours</li>
     <li><i class="fa-solid fa-check"></i> Up to 2 social media profiles set up or cleaned up</li>
     <li><i class="fa-solid fa-check"></i> 100 business cards</li>
     <li><i class="fa-solid fa-check"></i> Professional business email setup guidance</li>
     <li><i class="fa-solid fa-check"></i> No website required</li>
    </ul>
    <a class="btn btn-orange price-btn" href="https://square.link/u/h7pS4Z9i?src=sheet" target="_blank" rel="noopener">Start at $99</a>
   </article>

   <article class="price-card">
    <span class="package-badge"><i class="fa-solid fa-rocket"></i> Starter</span>
    <h3>SBC Business Starter</h3>
    <p class="desc">A professional starting point for a new or small business ready to establish its online presence.</p>
    <div class="price">$199 <small>setup</small></div>
    <div class="value">Built to get you started</div>
    <ul class="price-list">
     <li><i class="fa-solid fa-check"></i> Domain setup</li>
     <li><i class="fa-solid fa-check"></i> Basic hosting</li>
     <li><i class="fa-solid fa-check"></i> 1-page website</li>
     <li><i class="fa-solid fa-check"></i> 100 business cards</li>
     <li><i class="fa-solid fa-check"></i> Basic setup support</li>
    </ul>
    <a class="btn btn-orange price-btn" href="https://square.link/u/lKxGXNQs?src=sheet" target="_blank" rel="noopener">Start for $199</a>
   </article>

   <article class="price-card featured">
    <span class="popular-tag">Most Popular</span>
    <span class="package-badge"><i class="fa-solid fa-briefcase"></i> Essentials</span>
    <h3>Business Essentials</h3>
    <p class="desc">A stronger everyday package for an established small business that needs a more complete professional presence.</p>
    <div class="price">$349 <small>setup</small></div>
    <div class="value">More tools. More presence.</div>
    <ul class="price-list">
     <li><i class="fa-solid fa-check"></i> Domain + hosting</li>
     <li><i class="fa-solid fa-check"></i> Up to 4-page website</li>
     <li><i class="fa-solid fa-check"></i> Mobile optimization</li>
     <li><i class="fa-solid fa-check"></i> 200 business cards</li>
     <li><i class="fa-solid fa-check"></i> Basic maintenance support</li>
    </ul>
    <a class="btn btn-orange price-btn" href="https://square.link/u/uf53mzCR" target="_blank" rel="noopener">Choose $349 Essentials</a>
   </article>

   <article class="price-card">
    <span class="package-badge"><i class="fa-solid fa-building"></i> Complete Launch</span>
    <h3>SBC Complete Business Launch</h3>
    <p class="desc">A premium launch package for businesses that want the major pieces handled together from the start.</p>
    <div class="price">$699 <small>setup</small></div>
    <div class="value">A complete business launch</div>
    <ul class="price-list">
     <li><i class="fa-solid fa-check"></i> Professional website</li>
     <li><i class="fa-solid fa-check"></i> Domain + domain protection</li>
     <li><i class="fa-solid fa-check"></i> Free SSL</li>
     <li><i class="fa-solid fa-check"></i> Microsoft 365 business email</li>
     <li><i class="fa-solid fa-check"></i> Managed WordPress hosting</li>
     <li><i class="fa-solid fa-check"></i> 500 business cards</li>
    </ul>
    <a class="btn btn-orange price-btn" href="tel:305-496-1065" rel="nofollow">Call SBC to order for $699</a>
    <div class="small-note">Provider terms, taxes, shipping, premium domains, and special production requests may affect the final total where applicable.</div>
   </article>
  </div>

  <div class="sales-steps" aria-label="How the SBC package process works">
   <div class="sales-step"><strong>1. Tell us what you need</strong><span>Call, request help, or choose a package.</span></div>
   <div class="sales-step"><strong>2. Choose your path</strong><span>SBC helps match the solution to your business.</span></div>
   <div class="sales-step"><strong>3. Pay securely</strong><span>Use the available SBC checkout option.</span></div>
   <div class="sales-step"><strong>4. Get started</strong><span>Your order moves into SBC’s fulfillment process.</span></div>
  </div>

  <div class="refund-banner">
   <i class="fa-solid fa-shield-heart"></i>
   <div>
    <strong>14-Day Customer Return & Refund Policy</strong>
    <span>Customers may request cancellation/refund within 14 calendar days of purchase, subject to the applicable service terms. Third-party products or services that have already been activated, registered, provisioned, delivered, or otherwise incurred non-refundable costs may have separate terms. SBC will disclose applicable exceptions and process requests according to its published policy.</span>
   </div>
  </div>

  <div class="economics">
   <div class="econ"><strong>Simple choices</strong><span>Four clear options make it easier to start at the right level and move up when your business is ready.</span></div>
   <div class="econ"><strong>Right-size your purchase</strong><span>Choose the package that matches your current business needs instead of paying for services you do not need.</span></div>
   <div class="econ"><strong>Upgrade path</strong><span>Start with the essentials and add services as your business grows.</span></div>
   <div class="econ"><strong>Recurring services</strong><span>Domain, hosting, email renewals and other recurring services are billed separately where applicable.</span></div>
  </div>

  <p class="pricing-note"><strong>Pricing note:</strong> Package prices are the current SBC customer-facing sales structure. Provider pricing, premium domains, taxes, shipping, special production requests, additional website scope, and other applicable costs may change a final quote.</p>
 </div>
 </section>

 

 <section class="section proof-section">
  <div class="container">
   <div class="section-heading">
    <span class="eyebrow" style="background:rgba(255,255,255,.06);color:#fdba74;border-color:rgba(249,115,22,.3);">Earned, not invented</span>
    <h2>The proof grows with every business we help.</h2>
    <p>We do not manufacture statistics or make promises we cannot support. As SBC grows, the goal is simple: do good work, build real customer relationships and let the results speak for themselves.</p>
   </div>
   <div class="proof-grid">
    <div class="proof-card"><div class="proof-num">01</div><h3>Built from scratch</h3><p>SBC's digital presence and early projects have been built through hands-on work, training and continuous learning.</p></div>
    <div class="proof-card"><div class="proof-num">02</div><h3>One customer at a time</h3><p>Every order is an opportunity to create a relationship that can grow into additional business solutions.</p></div>
    <div class="proof-card"><div class="proof-num">03</div><h3>Designed to scale</h3><p>The long-term goal is a recognizable company with multiple locations serving businesses and organizations at a larger level.</p></div>
   </div>
  </div>
 </section>

 <section id="neon-signs" class="section neon-section">
  <div class="container">
   <div class="section-heading">
    <span class="eyebrow">New SBC Business Solution</span>
    <h2>Make Your Business Glow.</h2>
    <p>Custom LED & neon signs that put your business name, logo or message where customers can see it. Tell us what you're thinking and SBC will help turn the idea into a sign request.</p>
   </div>
   <div class="neon-card">
    <div class="neon-copy">
     <span class="eyebrow" style="background:rgba(255,255,255,.06);color:#fdba74;border-color:rgba(249,115,22,.3);">Custom LED & Neon Signs</span>
     <h3>Your Name. Your Logo. Lit Up.</h3>
     <p>Perfect for storefronts, service businesses, restaurants, offices, photo walls and events. You don't need to know the exact size or price before contacting us.</p>
     <div class="neon-points">
      <div class="neon-point" tabindex="0" title="Exterior or interior signs that help your business stand out and make your location easier to notice.">
       <strong><i class="fa-solid fa-store"></i>Storefronts</strong>
       <span>Make your business name or logo easier to see and remember.</span>
      </div>
      <div class="neon-point" tabindex="0" title="Custom branding signs for barber shops, salons, studios and other personal-service businesses.">
       <strong><i class="fa-solid fa-scissors"></i>Salons & Barbershops</strong>
       <span>Turn your logo, business name or signature phrase into wall branding.</span>
      </div>
      <div class="neon-point" tabindex="0" title="Signs for restaurants, food businesses, counters, dining areas and branded photo spots.">
       <strong><i class="fa-solid fa-utensils"></i>Restaurants</strong>
       <span>Add a branded focal point for an entrance, wall, counter or customer area.</span>
      </div>
      <div class="neon-point" tabindex="0" title="Custom illuminated pieces for offices, content spaces, events, parties and branded backdrops.">
       <strong><i class="fa-solid fa-camera"></i>Photo & Event Spaces</strong>
       <span>Create a memorable illuminated backdrop for photos, content or events.</span>
      </div>
     </div>
     <div class="neon-form">
      <h4>Start With Your Idea</h4>
      <p>Have a logo, sketch, inspiration photo or just an idea? Give us the basics and we'll follow up about the best next step.</p>
      <form id="signForm" method="post" enctype="multipart/form-data" onsubmit="return submitSbcForm(event, this)">
       <input type="hidden" name="sbc_form" value="sign">
       <input type="text" name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0;">
       <div class="neon-form-grid">
        <input type="text" name="name" placeholder="Your name" aria-label="Your name" required>
        <input type="text" name="business" placeholder="Business name" aria-label="Business name">
        <input type="text" name="sign_type" placeholder="What are you looking for?" aria-label="What are you looking for?" required>
        <input type="text" name="size" placeholder="Approx. size, if known" aria-label="Approximate size">
        <textarea name="details" placeholder="Describe your idea — words, colors, logo, where it will go, and anything else you know." aria-label="Describe your sign idea" required></textarea>
       </div>
       <label style="display:block;margin-top:10px;font-size:11px;font-weight:800;color:#cbd5e1;">Optional: choose a logo, sketch or inspiration image</label>
       <input type="file" name="design" accept="image/*,.pdf" aria-label="Upload logo, sketch or inspiration image">
       <p class="neon-file-note">Browser email forms do not reliably send attachments. If you select a file, SBC may ask you to send it separately after we receive your request.</p>
       <button class="btn btn-orange" type="submit"><i class="fa-solid fa-paper-plane"></i> Send My Sign Idea</button>
       <p id="signNotice" style="display:none;margin-top:12px;font-size:12px;font-weight:800;"></p>
      </form>
     </div>
    </div>
    <div class="neon-visual" aria-label="Example illuminated SBC branding concept">
     <div style="text-align:center;">
      <div class="neon-word">SBC</div>
      <div class="neon-small">Your brand. Your sign.</div>
     </div>
    </div>
   </div>
   <div class="trust-note">
    <span><i class="fa-solid fa-check-circle"></i> Custom designs</span>
    <span><i class="fa-solid fa-check-circle"></i> Quote-based service</span>
    <span><i class="fa-solid fa-check-circle"></i> SBC partner service</span>
   </div>
  </div>
 </section>

 <section id="print" class="section print">
 <div class="container">
 <div class="section-heading">
 <span class="eyebrow">Print shop</span>
 <h2>Professional business cards without the runaround.</h2>
 <p>Business cards are one of the easiest ways to turn SBC into the ongoing print provider for your customers.</p>
 </div>

 <div class="print-layout">
 <div class="print-panel">
 <span class="eyebrow">Popular service</span>
 <h3>Business cards that match the website.</h3>
 <p>Keep the colors, logo, phone number and website consistent across every customer touchpoint.</p>
 <div class="print-badges" aria-label="Business card service details">
 <div class="print-badge info-badge" tabindex="0" data-tip="Need a card designed from scratch, cleaned up, or prepared for print? SBC can help get your artwork ready."><i class="fa-solid fa-pen-ruler"></i><br><strong>Design help</strong></div>
 <div class="print-badge info-badge" tabindex="0" data-tip="Choose the quantity that fits your needs: 100, 200, 500 or 1,000 cards, with additional quantities available by quote."><i class="fa-solid fa-box"></i><br><strong>Quantity options</strong></div>
 <div class="print-badge info-badge" tabindex="0" data-tip="When you need the same cards again, SBC can help make the reorder process quick and simple."><i class="fa-solid fa-repeat"></i><br><strong>Easy reorders</strong></div>
 <div class="print-badge info-badge" tabindex="0" data-tip="We can keep your logo, colors, contact information and website consistent across your printed materials."><i class="fa-solid fa-palette"></i><br><strong>Brand matching</strong></div>
 </div>
 </div>

 <div class="print-table" aria-label="Example business card pricing">
 <div class="print-row header"><span>Quantity</span><span>Customer price</span><span>Best for</span><span>Order</span></div>
 <div class="print-row"><strong>100 cards</strong><span class="price-cell">$40</span><span>First order / test run</span><a class="btn btn-orange" href="https://square.link/u/QBqS1dri" target="_blank" rel="noopener">Order</a></div>
 <div class="print-row"><strong>200 cards</strong><span class="price-cell">$50</span><span>Everyday business use</span><a class="btn btn-orange" href="https://square.link/u/G4DTFmin" target="_blank" rel="noopener">Order</a></div>
 <div class="print-row"><strong>500 cards</strong><span class="price-cell">$75</span><span>High-volume networking</span><a class="btn btn-orange" href="https://square.link/u/oN2M9stv" target="_blank" rel="noopener">Order</a></div>
 <div class="print-row"><strong>1,000 cards</strong><span class="price-cell">$110</span><span>Established businesses</span><a class="btn btn-orange" href="https://square.link/u/5chWtP1V" target="_blank" rel="noopener">Order</a></div>
 <div class="print-row"><strong>Flyers / menus / signs</strong><span class="price-cell">Quote</span><span>Based on size & quantity</span><a class="btn btn-light" style="background:var(--navy);color:white;border-color:var(--navy);" href="tel:3054961065">Call</a></div>
 </div>
 <div class="questionnaire">
   <h4><i class="fa-solid fa-clipboard-list"></i> Just ordered business cards?</h4>
   <p>Tell SBC what you want on your cards so we have a clear starting point for your design.</p>
   <a class="btn btn-orange" href="#card-questionnaire"><i class="fa-solid fa-arrow-down"></i> Card Design Questionnaire</a>
 </div>
 </div>
 </div>
 <p class="pricing-note">Print prices are customer-facing SBC examples. Shipping, specialty finishes, rush production, artwork complexity and vendor pricing can change the final total.</p>
 </div>
 </section>

 
<section class="section card-design-feature" aria-labelledby="card-design-feature-title">
  <div class="container">
    <div class="card-design-callout">
      <div class="card-design-icon"><i class="fa-solid fa-wand-magic-sparkles"></i></div>
      <div class="card-design-copy">
        <span class="eyebrow">Need design help?</span>
        <h2 id="card-design-feature-title">Your Business Card. Your Way.</h2>
        <p><strong>Already know what you want? Great. Not sure? That's okay too.</strong> Tell SBC your business name, colors, style and what you want on the card. We'll help turn your idea into a professional business card.</p>
      </div>
      <a class="btn btn-orange" href="#card-questionnaire"><i class="fa-solid fa-arrow-down"></i> Tell SBC How You Want It</a>
    </div>
  </div>
</section>

<section id="card-questionnaire" class="section" style="background:#f8fafc;">
 <div class="container">
 <div class="section-heading">
 <span class="eyebrow">After you order</span>
 <h2>Tell us how you want your business cards to look.</h2>
 <p>Use these questions as your design brief. You can send the answers to SBC by text or print/save them for your records.</p>
 </div>
 <div class="card" style="max-width:850px;margin:0 auto;padding:28px;">
 <form id="cardQuestionnaire" onsubmit="return prepareCardBrief(event)">
   <input type="hidden" name="sbc_form" value="card">
   <input type="text" name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0;">
   <div class="question-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
     <label>Business name
       <input id="qBusiness" required placeholder="Your business name">
     </label>
     <label>Your name
       <input id="qName" required placeholder="Your name">
     </label>
     <label>Phone number
       <input id="qPhone" type="tel" placeholder="Best contact number">
     </label>
     <label>Card quantity
       <select id="qQty"><option>100</option><option>200</option><option>500</option><option>1,000</option><option>Other / Quote</option></select>
     </label>
     <label>Preferred colors
       <input id="qColors" placeholder="Example: blue and orange">
     </label>
     <label>Style
       <select id="qStyle"><option>Clean & professional</option><option>Bold & modern</option><option>Luxury / premium</option><option>Simple & minimal</option><option>Let SBC recommend</option></select>
     </label>
   </div>
   <label class="full-question">What should be on the card?
     <textarea id="qDetails" rows="4" placeholder="Logo, phone, website, email, address, services, social media, slogan, etc."></textarea>
   </label>
   <label class="full-question">Anything else SBC should know?
     <textarea id="qNotes" rows="3" placeholder="Examples: double-sided, include a QR code, match my website, use a specific image, etc."></textarea>
   </label>
   <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:18px;">
     <button class="btn btn-orange" type="submit"><i class="fa-solid fa-comment-sms"></i> Prepare Text to SBC</button>
     <button class="btn" type="button" onclick="emailCardBrief()" style="background:var(--blue);color:#fff;"><i class="fa-solid fa-envelope"></i> Send Brief to SBC</button>
     <button class="btn" type="button" onclick="window.print()" style="background:var(--navy);color:#fff;">Print / Save Brief</button>
   </div>
   <p id="briefNotice" style="display:none;margin-top:14px;color:#047857;font-size:12px;font-weight:700;"></p>
 </form>
 </div>
 </div>
 </section>

 <section class="section founder">
  <div class="container founder-grid">
   <div class="founder-card">
    <div>
     <div class="founder-mark">SBC</div>
     <h3>Successful By Choice starts with a simple idea.</h3>
     <p>We all make choices every day. Success is one of them.</p>
    </div>
    <div class="founder-sign">Successful By Choice<span>Because Why Not?</span></div>
   </div>
   <div class="founder-copy">
    <span class="eyebrow">Why I started SBC</span>
    <h2>I wanted to build something of my own — and build it the right way.</h2>
    <p>I started Successful By Choice because I didn't want to spend the rest of my life working for someone else. I also saw a real need in the business market: owners need practical help, but they shouldn't have to figure out every piece alone.</p>
    <p>SBC is my way of putting that idea into action — staying active, continuing to learn, challenging myself and building a company that can grow beyond me.</p>
    <p>And on a personal level, I want to build something my daughter can be proud of. That's part of what keeps me moving forward.</p>
    <div class="beliefs">
     <div class="belief"><strong>Professional</strong><span>Do the work carefully and take the details seriously.</span></div>
     <div class="belief"><strong>Trustworthy</strong><span>Be honest about what SBC can do and what it still needs to prove.</span></div>
     <div class="belief"><strong>Friendly</strong><span>Make it comfortable for a business owner to ask questions.</span></div>
     <div class="belief"><strong>Built to grow</strong><span>Start local, build the foundation and earn the opportunity to go further.</span></div>
    </div>
    <div class="future-banner"><strong>The long-term vision</strong><span>Multiple locations. A recognizable name. Services trusted by businesses, schools and organizations — with the infrastructure to support that growth.</span></div>
   </div>
  </div>
 </section>

 <section class="section process">
 <div class="container">
 <div class="section-heading">
 <span class="eyebrow">Simple process</span>
 <h2>Start with what you need. Build from there.</h2>
 <p>You do not need to have the whole plan figured out before you call. Start with one need, or let SBC help you build a complete setup.</p>
 </div>
 <div class="process-grid">
 <div class="card step"><div class="step-num">01</div><h3>Tell us what you need</h3><p>Google Business, social media, website, cards, hosting, domain, email, printing or a complete package.</p></div>
 <div class="card step"><div class="step-num">02</div><h3>Choose the right path</h3><p>Buy directly, choose a package, call us or request a custom scope. We are flexible about how you get started.</p></div>
 <div class="card step"><div class="step-num">03</div><h3>We build the pieces</h3><p>SBC coordinates setup, design and production around your business goals.</p></div>
 <div class="card step"><div class="step-num">04</div><h3>Launch & keep growing</h3><p>Keep SBC as the point of contact for future changes, renewals and print reorders.</p></div>
 </div>
 </div>
 </section>

 <section id="faq" class="section">
 <div class="container">
 <div class="section-heading">
 <span class="eyebrow">FAQ</span>
 <h2>Questions before getting started?</h2>
 <p>Here are the answers to the questions business owners ask most often.</p>
 </div>
 <div class="faq-grid">
 <details><summary>Do I have to buy hosting and a website together?</summary><p>No. SBC can provide domains, hosting, website work and print services separately. Packages simply make the combined services easier to buy.</p></details>
 <details><summary>What is SBC’s 14-day refund policy?</summary><p>Customers may request cancellation or a refund within 14 calendar days of purchase, subject to the applicable service terms. Third-party products or services that have already been activated, registered, provisioned, delivered, or incurred non-refundable costs may have separate terms. SBC will explain applicable exceptions and process requests according to the published policy.</p></details>
 <details><summary>Which package should I choose?</summary><p>Start with the package that matches what your business needs today. If you are unsure, call SBC at 305-496-1065 and we can help you determine which package or individual service is appropriate.</p></details>
 <details><summary>Can I use a domain I already own?</summary><p>Yes. Existing domains can often be connected to your hosting and website instead of purchasing a new domain.</p></details>
 <details><summary>Can you print my existing design?</summary><p>Yes. Send the print-ready file and SBC can quote the production. Design cleanup or recreation can be added when necessary.</p></details>
 <details><summary>Are the package prices the final price?</summary><p>They are customer-facing starting examples. Premium domains, special printing, additional website scope, taxes and shipping can change a final quote.</p></details>
 <details><summary>Do packages include future website changes?</summary><p>Basic setup support is included according to package scope. Larger future changes can be handled as additional work or a maintenance arrangement.</p></details>
 <details><summary>How do I get started?</summary><p>Call Successful By Choice at 305-496-1065, email j@sbcmia.com, or visit SBC Websites for web, hosting and domain services.</p></details>
 <details><summary>Can SBC help if I already have a logo or website?</summary><p>Absolutely. SBC can work with your existing branding, domain, website or print artwork and help improve, update or connect the pieces instead of starting over.</p></details>
 <details><summary>Can I order business cards without buying a website?</summary><p>Yes. Business cards and other print services can be purchased separately. You do not need to purchase a website, hosting or a package to order printing.</p></details>
 <details><summary>What happens after I order my business cards?</summary><p>SBC will use your card design questionnaire and any artwork you provide to establish the design direction, confirm the details and prepare the cards for production.</p></details>
 <details><summary>Can SBC create a QR code for my business card?</summary><p>Yes. SBC can help place a QR code on your card that points customers to a website, contact information, booking page, social profile or another approved destination.</p></details>
 </div>
 </div>
 </section>

 <section class="section" style="padding-top:0;">
 <div class="container">
 <div class="cta">
 <div>
 <h2>Ready to make your business easier to build?</h2>
 <p>Tell us what you need. We'll help you figure out the next step — whether that's one service, a package or the complete SBC approach.</p>
 </div>
 <div class="cta-actions">
 <a class="btn btn-orange" href="tel:3054961065"><i class="fa-solid fa-phone"></i> 305-496-1065</a>
 <a class="btn btn-light" href="https://sbcwebsites.com" target="_blank" rel="noopener"><i class="fa-solid fa-globe"></i> Visit SBC Websites</a>
 </div>
 </div>
 </div>
 </section>
 </main>

 <div style="background:#fff;border-top:1px solid #e2e8f0;">
  <div class="container" style="padding:24px 0;text-align:center;color:#64748b;font-size:12px;">
   SBC works with established service providers and production partners where appropriate. We focus on making the experience simpler, more personal and easier for business owners to manage.
  </div>
 </div>

 <footer>
 <div class="container">
 <div class="footer-grid">
 <div>
 <div class="brand" style="margin-bottom:14px;"><div class="brand-mark">SBC</div><div><div class="brand-title" style="color:white;">Successful By Choice</div><div class="brand-sub" style="color:#64748b;">Digital & Print Solutions</div></div></div>
 <p>One place for websites, hosting, business email, printing, signage, notary services and practical business solutions.</p><p class="footer-tagline">Professional. Trustworthy. Friendly. <strong>Because Why Not?</strong></p>
 </div>
 <div>
 <div class="footer-title">Services</div>
 <div class="footer-links"><a href="#services">Website Design</a><a href="#services">Domains & Hosting</a><a href="#print">Business Cards</a><a href="#print">Marketing Materials</a><a href="#neon-signs">LED & Neon Signs</a><a href="#why-sbc">Why SBC</a></div>
 </div>
 <div>
 <div class="footer-title">Contact</div>
 <div class="footer-links"><a href="tel:3054961065">305-496-1065</a><a href="#pricing">View Packages</a><a href="https://sbcwebsites.com" target="_blank" rel="noopener">SBC Websites</a><span style="color:#94a3b8;font-size:13px;">Miami, Florida</span></div>
 </div>
 </div>
 <div style="margin-top:22px;padding-top:18px;border-top:1px solid rgba(255,255,255,.08);color:#64748b;font-size:11px;">
 Website, domain, hosting, SSL, security, and related products may be provided through authorized reseller partnerships.
 </div>
 <div class="footer-bottom"><span>© 2026 Successful By Choice. All rights reserved.</span><span>GoDaddy products are provided through SBC's reseller relationship. Product/provider terms and pricing may apply.</span></div>
 </div>
 </footer>

 <script>
 (function () {
 const btn = document.getElementById('mobileMenuBtn');
 const nav = document.getElementById('mobileNav');
 if (!btn || !nav) return;
 btn.addEventListener('click', function () {
 const open = nav.classList.toggle('open');
 btn.setAttribute('aria-expanded', String(open));
 btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
 btn.innerHTML = open ? '<i class="fa-solid fa-xmark"></i>' : '<i class="fa-solid fa-bars"></i>';
 });
 window.emailCardBrief = function () {
   const form = document.getElementById('cardQuestionnaire');
   const data = new FormData(form);
   const notice = document.getElementById('briefNotice');
   fetch(window.location.href, { method:'POST', body:data, headers:{'X-Requested-With':'XMLHttpRequest'} })
     .then(r => r.json())
     .then(result => {
       notice.style.display = 'block';
       notice.style.color = result.ok ? '#047857' : '#b91c1c';
       notice.textContent = result.message;
     })
     .catch(() => {
       notice.style.display = 'block';
       notice.style.color = '#b91c1c';
       notice.textContent = 'We could not send the brief from the website right now. Please call 305-496-1065 or email j@sbcmia.com.';
     });
 };

 window.submitSbcForm = function (event, form) {
   event.preventDefault();
   const noticeId = form.id === 'signForm' ? 'signNotice' : 'briefNotice';
   const notice = document.getElementById(noticeId);
   const button = form.querySelector('button[type="submit"]');
   if (button) { button.disabled = true; button.style.opacity = '.7'; }
   fetch(window.location.href, { method:'POST', body:new FormData(form), headers:{'X-Requested-With':'XMLHttpRequest'} })
     .then(r => r.json())
     .then(result => {
       notice.style.display = 'block';
       notice.style.color = result.ok ? '#047857' : '#b91c1c';
       notice.textContent = result.message;
       if (result.ok && form.id === 'signForm') form.reset();
     })
     .catch(() => {
       notice.style.display = 'block';
       notice.style.color = '#b91c1c';
       notice.textContent = 'We could not send the request from the website right now. Please call 305-496-1065 or email j@sbcmia.com.';
     })
     .finally(() => { if (button) { button.disabled = false; button.style.opacity = '1'; } });
   return false;
 };

 window.prepareCardBrief = function (event) {
   event.preventDefault();
   const get = id => document.getElementById(id).value.trim();
   const message = [
     'SBC BUSINESS CARD DESIGN BRIEF',
     'Business: ' + get('qBusiness'),
     'Name: ' + get('qName'),
     'Phone: ' + get('qPhone'),
     'Quantity: ' + get('qQty'),
     'Colors: ' + get('qColors'),
     'Style: ' + get('qStyle'),
     'Card details: ' + get('qDetails'),
     'Notes: ' + get('qNotes')
   ].join('\\n');
   const notice = document.getElementById('briefNotice');
   notice.style.display = 'block';
   notice.textContent = 'Your design brief is ready. Your device should open a text message addressed to SBC.';
   window.location.href = 'sms:3054961065?body=' + encodeURIComponent(message);
   return false;
 };

 nav.querySelectorAll('a').forEach(function (link) {
 link.addEventListener('click', function () {
 nav.classList.remove('open');
 btn.setAttribute('aria-expanded', 'false');
 btn.setAttribute('aria-label', 'Open menu');
 btn.innerHTML = '<i class="fa-solid fa-bars"></i>';
 });
 });
 })();
 </script>

<div id="sbc-v27-portal-backdrop" aria-hidden="true">
  <div id="sbc-v27-portal" role="dialog" aria-modal="true" aria-label="SBC Customer Account">
    <div class="phead">
      <strong><i class="fa-solid fa-user-circle"></i> My SBC Account</strong>
      <button class="x" type="button" onclick="SBCPortal.close()" aria-label="Close">×</button>
    </div>
    <div class="pbody">
      <div id="sbc-portal-message"></div>
      <div id="sbc-auth-area">
        <div class="tabs">
          <button id="sbc-login-tab" class="active" onclick="SBCPortal.mode('login')">Log In</button>
          <button id="sbc-register-tab" onclick="SBCPortal.mode('register')">Create Account</button>
        </div>
        <form id="sbc-login-form" onsubmit="SBCPortal.submitLogin(event)">
          <label>Email</label><input id="sbc-login-email" type="email" required autocomplete="email">
          <label>Password</label><input id="sbc-login-password" type="password" required autocomplete="current-password">
          <button class="btn btn-orange" style="width:100%;margin-top:16px" type="submit">Log In</button>
        </form>
        <form id="sbc-register-form" style="display:none" onsubmit="SBCPortal.submitRegister(event)">
          <label>Your Name</label><input id="sbc-reg-name" required autocomplete="name">
          <label>Business Name</label><input id="sbc-reg-business" required autocomplete="organization">
          <label>Email</label><input id="sbc-reg-email" type="email" required autocomplete="email">
          <label>Password</label><input id="sbc-reg-password" type="password" minlength="8" required autocomplete="new-password">
          <button class="btn btn-orange" style="width:100%;margin-top:16px" type="submit">Create My SBC Account</button>
        </form>
      </div>
      <div id="sbc-account-area" style="display:none">
        <h3 id="sbc-account-welcome"></h3>
        <div class="account-grid">
          <div class="account-card"><h4>📦 My Services</h4><span id="sbc-account-services">Loading…</span></div>
          <div class="account-card"><h4>🧾 My Orders</h4><span id="sbc-account-orders">Loading…</span></div>
        </div>
        <div class="account-card"><h4>💬 Message SBC</h4>
          <div id="sbc-account-messages" style="max-height:180px;overflow:auto;margin:10px 0"></div>
          <textarea id="sbc-account-new-message" rows="3" placeholder="Send a message to the SBC team…"></textarea>
          <div class="account-actions">
            <button class="btn btn-orange" onclick="SBCPortal.sendMessage()">Send Message</button>
            <button class="btn" style="background:#0f172a;color:#fff" onclick="SBCPortal.refresh()">Refresh</button>
            <button class="btn" style="background:#e2e8f0" onclick="SBCPortal.logout()">Log Out</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>


<script id="sbc-v27-portal-js">
const SBCPortal=(function(){
  const A='/index.php?sbc_portal=';
  const el=id=>document.getElementById(id);
  async function api(action,opts={}){
    const r=await fetch(A+encodeURIComponent(action),{credentials:'include',...opts});
    let j={}; try{j=await r.json()}catch(e){}
    if(!r.ok||j.ok===false)throw new Error(j.error||j.message||'SBC account request failed.');
    return j;
  }
  function msg(t,type=''){el('sbc-portal-message').innerHTML=t?'<div class="pmsg '+type+'">'+esc(t)+'</div>':''}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function open(){el('sbc-v27-portal-backdrop').classList.add('open');el('sbc-v27-portal-backdrop').setAttribute('aria-hidden','false');check()}
  function close(){el('sbc-v27-portal-backdrop').classList.remove('open');el('sbc-v27-portal-backdrop').setAttribute('aria-hidden','true')}
  function mode(m){el('sbc-login-form').style.display=m==='login'?'block':'none';el('sbc-register-form').style.display=m==='register'?'block':'none';el('sbc-login-tab').classList.toggle('active',m==='login');el('sbc-register-tab').classList.toggle('active',m==='register');msg('')}
  async function check(){try{await refresh()}catch(e){el('sbc-auth-area').style.display='block';el('sbc-account-area').style.display='none'}}
  async function submitLogin(e){e.preventDefault();msg('Signing you in…');try{await api('login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:el('sbc-login-email').value,password:el('sbc-login-password').value})});msg('Welcome back.','ok');await refresh()}catch(x){msg(x.message,'err')}}
  async function submitRegister(e){e.preventDefault();msg('Creating your SBC account…');try{await api('register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:el('sbc-reg-name').value,businessName:el('sbc-reg-business').value,email:el('sbc-reg-email').value,password:el('sbc-reg-password').value})});msg('Your SBC account is ready.','ok');await refresh()}catch(x){msg(x.message,'err')}}
  async function refresh(){
    const p=await api('profile'); const c=p.customer||p.user||p;
    el('sbc-auth-area').style.display='none';el('sbc-account-area').style.display='block';
    el('sbc-account-welcome').textContent='Welcome, '+(c.name||c.contactName||c.businessName||'SBC Customer')+' 👋';
    try{const j=await api('services');const a=j.services||j.items||[];el('sbc-account-services').textContent=a.length+' service'+(a.length===1?'':'s')}catch(e){el('sbc-account-services').textContent='See Command Center'}
    try{const j=await api('orders');const a=j.orders||j.items||[];el('sbc-account-orders').innerHTML=a.length?a.map(x=>'<div style="padding:10px 0;border-bottom:1px solid #e2e8f0"><strong>'+esc(x.product||x.id)+'</strong><br><span class="muted">Order '+esc(x.id)+' · $'+Number(x.price||0).toFixed(2)+' · '+esc(x.paymentStatus||x.status||'Pending')+'</span>'+(x.paymentUrl&&String(x.paymentStatus||'').toUpperCase()!=='PAID'?'<br><a class="btn btn-orange" style="display:inline-block;margin-top:7px" target="_blank" rel="noopener" href="'+esc(x.paymentUrl)+'">Pay Securely via Square</a>':'')+'</div>').join(''):'No orders yet.'}catch(e){el('sbc-account-orders').textContent='Orders are temporarily unavailable.'}
    try{const j=await api('messages');const a=j.messages||j.items||[];el('sbc-account-messages').innerHTML=a.length?a.map(x=>'<div style="padding:8px;border-bottom:1px solid #e2e8f0"><b>'+esc(x.senderName||x.sender||'SBC')+'</b><br>'+esc(x.message||x.body||x.content||'')+'</div>').join(''):'<span class="muted">No messages yet.</span>'}catch(e){el('sbc-account-messages').textContent='Messages are temporarily unavailable.'}
  }
  async function sendMessage(){const t=el('sbc-account-new-message').value.trim();if(!t)return;try{await api('send_message',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:t,body:t,content:t})});el('sbc-account-new-message').value='';await refresh();msg('Message sent to SBC.','ok')}catch(e){msg(e.message,'err')}}
  async function logout(){try{await api('logout',{method:'POST'})}catch(e){}el('sbc-account-area').style.display='none';el('sbc-auth-area').style.display='block';mode('login');msg('You are logged out.','ok')}
  return {open,close,mode,submitLogin,submitRegister,refresh,sendMessage,logout};
})();
</script>

<link rel="stylesheet" href="/public/lead-catch-v48-11.css?v=48.11.0"><script src="/public/lead-catch-v48-11.js?v=48.11.0"></script></body>
</html>

