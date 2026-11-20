package br.curitiba.eclub.comunidade;

// Comunidade Liberal — app Android (v2.3)
// Abre a comunidade dentro do próprio app e liga a proteção de tela do Android (FLAG_SECURE):
// print e gravação de tela saem pretos. Câmera, galeria e GPS (check-in / Radar) funcionam.
// v2.2: a permissão do GPS fica guardada e a atualização é baixada e instalada por dentro do app.
// v2.3: versão da Play Store (BuildConfig.LOJA): confirmação de 18+, fotos desfocadas por padrão, sem auto-atualização.

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.SharedPreferences;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.provider.MediaStore;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.core.content.FileProvider;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class MainActivity extends Activity {

    private static final String SITE = "eclub.curitiba.br";
    private static final String INICIO = "https://eclub.curitiba.br/comunidade/entrar.html";
    private static final int PEDIDO_ARQUIVO = 10;
    private static final int PERMISSAO_LOCAL = 11;
    private static final int PERMISSAO_CAMERA = 12;
    // Versão nova do app: o GitHub publica aqui a cada montagem
    private static final String RELEASE_API = "https://api.github.com/repos/andrezinhoeclub/eclub/releases/tags/app-android";
    private static final String APK_URL = "https://github.com/andrezinhoeclub/eclub/releases/download/app-android/comunidade-liberal.apk";

    private WebView web;
    private ValueCallback<Uri[]> retornoArquivo;
    private Uri fotoDaCamera;
    private GeolocationPermissions.Callback retornoLocal;
    private String origemLocal;
    private boolean instalarAoVoltar = false;

    @Override
    protected void onCreate(Bundle salvo) {
        super.onCreate(salvo);

        // Bloqueia print e gravação de tela (também esconde a prévia na tela de apps recentes)
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
        getWindow().setStatusBarColor(Color.BLACK);
        getWindow().setNavigationBarColor(Color.BLACK);

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0B0A09"));
        // Moldura em volta do site: no Android 15+ (versão da loja) o app ocupa a tela toda,
        // então afasta o conteúdo da barra de cima, da barra de baixo e do teclado.
        FrameLayout moldura = new FrameLayout(this);
        moldura.setBackgroundColor(Color.BLACK);
        moldura.addView(web, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(moldura);
        if (BuildConfig.LOJA) {
            WindowCompat.setDecorFitsSystemWindows(getWindow(), false);   // tela toda em qualquer Android
            ViewCompat.setOnApplyWindowInsetsListener(moldura, (v, ins) -> {
                Insets b = ins.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.ime());
                v.setPadding(b.left, b.top, b.right, b.bottom);
                return WindowInsetsCompat.CONSUMED;
            });
        }

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setGeolocationEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setUserAgentString(s.getUserAgentString() + " CLApp/2.0" + (BuildConfig.LOJA ? " CLLoja" : ""));

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(web, true);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest pedido) {
                if (!pedido.isForMainFrame()) return false;
                return abrirFora(pedido.getUrl());
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origem, GeolocationPermissions.Callback retorno) {
                if (temLocalizacao()) {
                    retorno.invoke(origem, true, true);   // guarda: não pergunta de novo a cada tela
                } else {
                    retornoLocal = retorno;
                    origemLocal = origem;
                    requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,
                            Manifest.permission.ACCESS_COARSE_LOCATION}, PERMISSAO_LOCAL);
                }
            }

            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> retorno, FileChooserParams opcoes) {
                if (retornoArquivo != null) retornoArquivo.onReceiveValue(null);
                retornoArquivo = retorno;
                if (opcoes.isCaptureEnabled()) {
                    if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                        requestPermissions(new String[]{Manifest.permission.CAMERA}, PERMISSAO_CAMERA);
                    } else {
                        abrirCamera();
                    }
                } else {
                    abrirGaleria(opcoes);
                }
                return true;
            }
        });

        if (salvo != null) {
            web.restoreState(salvo);
        } else {
            web.loadUrl(enderecoInicial(getIntent()));
        }
        if (BuildConfig.LOJA) confirmarMaioridade();
    }

    // Versão da Play Store: confirma a maioridade na primeira vez que abre o app
    private void confirmarMaioridade() {
        final SharedPreferences prefs = getSharedPreferences("app", MODE_PRIVATE);
        if (prefs.getBoolean("maior18", false)) return;
        new AlertDialog.Builder(this)
                .setTitle("Somente para maiores de 18 anos")
                .setMessage("A Comunidade Liberal é uma comunidade de encontros para adultos. Para continuar, confirme que você tem 18 anos ou mais.")
                .setCancelable(false)
                .setPositiveButton("Tenho 18 anos ou mais", (d, w) -> prefs.edit().putBoolean("maior18", true).apply())
                .setNegativeButton("Sair", (d, w) -> finish())
                .show();
    }

    @Override
    protected void onResume() {
        super.onResume();
        // voltou da tela "permitir instalar": continua a atualização já baixada
        if (instalarAoVoltar && podeInstalar()) { instalarAoVoltar = false; instalarBaixado(); return; }
        verificarAtualizacao();
    }

    // ---------- Aviso de versão nova (no máximo a cada 6 horas) ----------
    private void verificarAtualizacao() {
        if (BuildConfig.LOJA) return;                // na Play Store quem atualiza é a própria loja
        final SharedPreferences prefs = getSharedPreferences("app", MODE_PRIVATE);
        long agora = System.currentTimeMillis();
        if (agora - prefs.getLong("ultima_verificacao", 0) < 6L * 3600 * 1000) return;
        prefs.edit().putLong("ultima_verificacao", agora).apply();
        new Thread(() -> {
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(RELEASE_API).openConnection();
                c.setRequestProperty("Accept", "application/vnd.github+json");
                c.setConnectTimeout(8000);
                c.setReadTimeout(8000);
                if (c.getResponseCode() != 200) return;
                InputStream in = c.getInputStream();
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                byte[] buf = new byte[8192];
                int n;
                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                in.close();
                Matcher m = Pattern.compile("codigo (\\d+)").matcher(out.toString("UTF-8"));
                if (!m.find()) return;
                int nova = Integer.parseInt(m.group(1));
                @SuppressWarnings("deprecation")
                int atual = getPackageManager().getPackageInfo(getPackageName(), 0).versionCode;
                if (nova > atual) runOnUiThread(this::avisarAtualizacao);
            } catch (Exception e) {
                // sem internet ou GitHub fora do ar: tenta de novo mais tarde
                prefs.edit().putLong("ultima_verificacao", 0).apply();
            }
        }).start();
    }

    private void avisarAtualizacao() {
        if (isFinishing()) return;
        new AlertDialog.Builder(this)
                .setTitle("Nova versão do app")
                .setMessage("Saiu uma versão nova do app da Comunidade Liberal. Toque em Atualizar: o app baixa e abre a instalação sozinho (você não perde nada).")
                .setPositiveButton("Atualizar", (d, w) -> baixarAtualizacao())
                .setNegativeButton("Depois", null)
                .show();
    }

    // ---------- Atualização por dentro do app (sem passar pelo navegador) ----------
    private File arquivoAtualizacao() {
        File pasta = new File(getCacheDir(), "atualizacao");
        if (!pasta.exists()) pasta.mkdirs();
        return new File(pasta, "comunidade-liberal.apk");
    }

    private void baixarAtualizacao() {
        LinearLayout caixa = new LinearLayout(this);
        caixa.setOrientation(LinearLayout.VERTICAL);
        int m = (int) (20 * getResources().getDisplayMetrics().density);
        caixa.setPadding(m, m, m, m / 2);
        final TextView texto = new TextView(this);
        texto.setText("Baixando a versão nova…");
        final ProgressBar barra = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        barra.setMax(100);
        caixa.addView(texto);
        caixa.addView(barra);
        final AlertDialog janela = new AlertDialog.Builder(this).setTitle("Atualizando o app").setView(caixa).setCancelable(false).show();
        new Thread(() -> {
            try {
                HttpURLConnection c = null;
                String endereco = APK_URL;
                for (int k = 0; k < 5; k++) {                     // o GitHub redireciona para o arquivo
                    c = (HttpURLConnection) new URL(endereco).openConnection();
                    c.setInstanceFollowRedirects(false);
                    c.setConnectTimeout(15000);
                    c.setReadTimeout(30000);
                    int cod = c.getResponseCode();
                    if (cod >= 300 && cod < 400 && c.getHeaderField("Location") != null) {
                        endereco = new URL(new URL(endereco), c.getHeaderField("Location")).toString();
                        c.disconnect();
                        continue;
                    }
                    break;
                }
                if (c == null || c.getResponseCode() != 200) throw new Exception("http");
                long total = c.getContentLengthLong();
                File destino = arquivoAtualizacao();
                InputStream in = c.getInputStream();
                FileOutputStream out = new FileOutputStream(destino);
                byte[] buf = new byte[65536];
                long lido = 0;
                int n, ultimo = -1;
                while ((n = in.read(buf)) > 0) {
                    out.write(buf, 0, n);
                    lido += n;
                    if (total > 0) {
                        final int pct = (int) (lido * 100 / total);
                        if (pct != ultimo) { ultimo = pct; runOnUiThread(() -> barra.setProgress(pct)); }
                    }
                }
                out.close();
                in.close();
                runOnUiThread(() -> {
                    try { janela.dismiss(); } catch (Exception ignorar) { }
                    if (podeInstalar()) instalarBaixado(); else pedirPermissaoInstalar();
                });
            } catch (Exception e) {
                runOnUiThread(() -> {
                    try { janela.dismiss(); } catch (Exception ignorar) { }
                    new AlertDialog.Builder(this).setTitle("Não deu para baixar")
                            .setMessage("Confira a internet e tente de novo. Se preferir, baixe pelo navegador.")
                            .setPositiveButton("Tentar de novo", (d, w) -> baixarAtualizacao())
                            .setNegativeButton("Pelo navegador", (d, w) -> {
                                try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(APK_URL))); } catch (ActivityNotFoundException x) { }
                            })
                            .show();
                });
            }
        }).start();
    }

    private boolean podeInstalar() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.O || getPackageManager().canRequestPackageInstalls();
    }

    // Só na primeira atualização: o Android pede para liberar "instalar apps" para a Comunidade
    private void pedirPermissaoInstalar() {
        new AlertDialog.Builder(this)
                .setTitle("Falta só uma liberação")
                .setMessage("Na próxima tela, ative \"Permitir desta fonte\" e volte para o app. Isso é pedido uma única vez; nas próximas atualizações é só tocar em Instalar.")
                .setPositiveButton("Liberar", (d, w) -> {
                    instalarAoVoltar = true;
                    try {
                        startActivity(new Intent("android.settings.MANAGE_UNKNOWN_APP_SOURCES", Uri.parse("package:" + getPackageName())));
                    } catch (ActivityNotFoundException e) {
                        instalarAoVoltar = false;
                        instalarBaixado();
                    }
                })
                .setNegativeButton("Depois", null)
                .show();
    }

    private void instalarBaixado() {
        File apk = arquivoAtualizacao();
        if (!apk.exists()) { baixarAtualizacao(); return; }
        try {
            Uri u = FileProvider.getUriForFile(this, getPackageName() + ".arquivos", apk);
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(u, "application/vnd.android.package-archive");
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (Exception e) {
            try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(APK_URL))); } catch (ActivityNotFoundException x) { }
        }
    }

    private String enderecoInicial(Intent i) {
        if (i != null && i.getData() != null && SITE.equals(i.getData().getHost())) return i.getData().toString();
        return INICIO;
    }

    @Override
    protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        if (i != null && i.getData() != null && SITE.equals(i.getData().getHost())) web.loadUrl(i.getData().toString());
    }

    // Links de fora da comunidade (WhatsApp, mapas, sites das casas) abrem no aplicativo certo
    private boolean abrirFora(Uri u) {
        String esquema = u.getScheme();
        if ("https".equals(esquema) && SITE.equals(u.getHost())) return false;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, u));
        } catch (ActivityNotFoundException e) {
            // nenhum app para abrir: ignora
        }
        return true;
    }

    private boolean temLocalizacao() {
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private void abrirGaleria(WebChromeClient.FileChooserParams opcoes) {
        fotoDaCamera = null;
        Intent i = opcoes.createIntent();
        if (opcoes.getMode() == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE) {
            i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        }
        try {
            startActivityForResult(i, PEDIDO_ARQUIVO);
        } catch (ActivityNotFoundException e) {
            cancelarArquivo();
        }
    }

    private void abrirCamera() {
        try {
            File pasta = new File(getCacheDir(), "fotos");
            if (!pasta.exists()) pasta.mkdirs();
            File arquivo = new File(pasta, "foto-" + System.currentTimeMillis() + ".jpg");
            fotoDaCamera = FileProvider.getUriForFile(this, getPackageName() + ".arquivos", arquivo);
            Intent i = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            i.putExtra(MediaStore.EXTRA_OUTPUT, fotoDaCamera);
            i.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivityForResult(i, PEDIDO_ARQUIVO);
        } catch (Exception e) {
            fotoDaCamera = null;
            cancelarArquivo();
        }
    }

    private void cancelarArquivo() {
        if (retornoArquivo != null) retornoArquivo.onReceiveValue(null);
        retornoArquivo = null;
    }

    @Override
    protected void onActivityResult(int pedido, int resultado, Intent dados) {
        super.onActivityResult(pedido, resultado, dados);
        if (pedido != PEDIDO_ARQUIVO || retornoArquivo == null) return;
        Uri[] escolhidos = null;
        if (resultado == RESULT_OK) {
            if (fotoDaCamera != null) {
                escolhidos = new Uri[]{fotoDaCamera};
            } else if (dados != null) {
                ClipData varios = dados.getClipData();
                if (varios != null && varios.getItemCount() > 0) {
                    escolhidos = new Uri[varios.getItemCount()];
                    for (int k = 0; k < varios.getItemCount(); k++) escolhidos[k] = varios.getItemAt(k).getUri();
                } else if (dados.getData() != null) {
                    escolhidos = new Uri[]{dados.getData()};
                }
            }
        }
        retornoArquivo.onReceiveValue(escolhidos);
        retornoArquivo = null;
        fotoDaCamera = null;
    }

    @Override
    public void onRequestPermissionsResult(int pedido, String[] permissoes, int[] respostas) {
        boolean ok = false;
        for (int r : respostas) if (r == PackageManager.PERMISSION_GRANTED) ok = true;
        if (pedido == PERMISSAO_LOCAL && retornoLocal != null) {
            retornoLocal.invoke(origemLocal, ok, ok);
            retornoLocal = null;
        } else if (pedido == PERMISSAO_CAMERA) {
            if (ok) abrirCamera(); else cancelarArquivo();
        }
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle saida) {
        super.onSaveInstanceState(saida);
        if (web != null) web.saveState(saida);
    }

    @Override
    protected void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
    }
}
