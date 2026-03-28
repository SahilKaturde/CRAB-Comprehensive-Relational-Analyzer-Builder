import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo/CRAB_LOGO.png';
import { authService } from '../api/auth';

const Login = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    
    try {
      await authService.login(formData);
      setMessage(`Logged in successfully!`);
      setTimeout(() => navigate('/chat'), 1000);
    } catch (error) {
      setMessage(error.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center py-10 px-5 bg-crab-bg">
      <div className="flex justify-center mb-10 animate-fade-in">
        <div className="p-4 bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(255,59,48,1)]">
          <img src={logo} alt="CRAB Logo" className="h-16 w-auto object-contain" />
        </div>
      </div>

      <div className="max-w-[480px] w-full animate-slide-up">
        <div className="brutalist-card p-8 md:p-10 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-crab-accent"></div>
          
          <h1 className="text-4xl md:text-5xl font-black leading-[1] uppercase mb-2 -tracking-wider text-crab-text text-left">
            WELCOME<br />
            BACK
          </h1>
          <p className="font-heading text-[10px] text-crab-accent mb-8 tracking-tighter text-left">TO CRAB ENGINE</p>
          
          <p className="font-mono text-[11px] font-bold text-black/40 uppercase mb-8 leading-relaxed tracking-widest text-left">
            Comprehensive Relational Analyzer and Builder
          </p>

          <form className="flex flex-col gap-5" onSubmit={handleLogin}>
            {message && (
              <div className="p-3 bg-crab-accent/5 border-l-4 border-crab-accent font-mono text-[10px] font-black uppercase text-crab-accent animate-fade-in text-left">
                {message}
              </div>
            )}
            
            <div className="space-y-1.5 text-left">
              <label className="font-mono text-[9px] font-black uppercase tracking-widest text-black/40 ml-1">Identity</label>
              <input 
                type="text" 
                name="username"
                placeholder="Username" 
                className="brutalist-input !py-3.5"
                value={formData.username}
                onChange={handleChange}
                required
              />
            </div>

            <div className="space-y-1.5 text-left">
              <label className="font-mono text-[9px] font-black uppercase tracking-widest text-black/40 ml-1">Credentials</label>
              <div className="space-y-3">
                <input 
                  type="email" 
                  name="email"
                  placeholder="Email address" 
                  className="brutalist-input !py-3.5"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
                <input 
                  type="password" 
                  name="password"
                  placeholder="Password" 
                  className="brutalist-input !py-3.5"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
            
            <div className="flex flex-col gap-3 mt-4">
              <button type="submit" className="brutalist-btn-primary" disabled={loading}>
                {loading ? 'INITIALIZING...' : 'ACCESS SYSTEM'}
              </button>
              <button 
                type="button" 
                className="brutalist-btn-secondary !bg-crab-muted/30 border-black/10 shadow-none hover:border-black hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-white"
                onClick={() => navigate('/register')}
              >
                CREATE ACCOUNT
              </button>
            </div>
          </form>
        </div>
        
        <p className="mt-8 font-mono text-[9px] text-center text-black/30 uppercase tracking-[0.3em]">
          &copy; 2026 CRAB DATA SYSTEMS • SECURE ACCESS ONLY
        </p>
      </div>
    </div>
  );
};

export default Login;
