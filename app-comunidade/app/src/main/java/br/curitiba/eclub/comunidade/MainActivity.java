package br.curitiba.eclub.comunidade;

// Comunidade Liberal — app Android (v2.0)
// Abre a comunidade dentro do próprio app e liga a proteção de tela do Android (FLAG_SECURE):
// print e gravação de tela saem pretos. Câmera, galeria e GPS (check-in / Radar) funcionam.

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
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

import java.io.File;

public class MainActivity extends Activity {

    private static final String SITE = "eclub.curitiba.br";
    private static final String INICIO = "https://eclub.curitiba.br/comunidade/entrar.html";
    private static final int PEDIDO_ARQUIVO = 10;
    private static final int PERMISSAO_LOCAL = 11;
    private static final int PERMISSAO_CAMERA = 12;

    private WebView web;
    private ValueCallback<Uri[]> retornoArquivo;
    private Uri fotoDaCamera;
    private GeolocationPermissions.Callback retornoLocal;
    private String origemLocal;

    @Override
    protected void onCreate(Bundle salvo) {
        super.onCreate(salvo);

        // Bloqueia print e gravação de tela (também esconde a prévia na tela de apps recentes)
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
        getWindow().setStatusBarColor(Color.BLACK);
        getWindow().setNavigationBarColor(Color.BLACK);

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0B0A09"));
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setGeolocationEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setUserAgentString(s.getUserAgentString() + " CLApp/2.0");

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
                    retorno.invoke(origem, true, false);
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
            retornoLocal.invoke(origemLocal, ok, false);
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
