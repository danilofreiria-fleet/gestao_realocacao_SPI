import React from 'react';
import { useNavigate } from "react-router-dom";
import { useGoogleLogin } from '@react-oauth/google';
import { Database } from 'lucide-react'; 
import axios from 'axios';

export default function Login() {
  const navigate = useNavigate();

const fazerLogin = useGoogleLogin({
  scope: "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.email",
  prompt: "consent", // <--- ADICIONE ESTA LINHA AQUI!
  
  onSuccess: async (tokenResponse) => {
      try {
        const userInfo = await axios.get(
          'https://www.googleapis.com/oauth2/v3/userinfo',
          { headers: { Authorization: `Bearer ${tokenResponse.access_token}` } }
        );

        // Substitua "@suaempresa.com" pelo domínio corporativo correto
        if (userInfo.data.email.endsWith("@shopee.com") || userInfo.data.hd === "shopee.com") {
          localStorage.setItem("spiToken", tokenResponse.access_token);
          localStorage.setItem("userEmail", userInfo.data.email);
          
          navigate("/app/tabela"); 
        } else {
          alert("Acesso negado. Use seu e-mail corporativo autorizado.");
        }
      } catch (error) {
        console.error("Erro ao validar credenciais", error);
        alert("Erro ao validar credenciais no Google.");
      }
    },
    onError: () => alert('Erro no Login')
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-8 relative overflow-hidden">
        
        <div className="absolute top-0 left-0 w-full h-1 bg-orange-600"></div>

        <div className="text-center mb-8 flex flex-col items-center">
          <div className=" bg-orange-600 p-3 rounded-xl mb-4 shadow-lg">
            <Database className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">SPI CONTROL</h1>
          <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-widest">Acesso Restrito - Logística</p>
        </div>

        <div className="space-y-5">
          <button 
            onClick={() => fazerLogin()}
            className="w-full flex items-center justify-center gap-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold py-4 px-4 rounded-xl shadow-sm transition-all active:scale-95"
          >
            {/* Ícone do Google */}
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Entrar com Google Workspace
          </button>
        </div>
      </div>
    </div>
  );
}