(function(){
  "use strict";
  var params=new URLSearchParams(window.location.search);
  var token=params.get('token')||'';
  var invite=document.getElementById('inviteForm');
  var reset=document.getElementById('resetForm');
  var message=document.getElementById('actionMessage');
  function show(text,error){if(!message)return;message.textContent=text;message.setAttribute('role',error?'alert':'status');}
  function submit(form,path){
    form.addEventListener('submit',async function(event){
      event.preventDefault();
      var button=form.querySelector('button[type=submit]');if(button)button.disabled=true;
      try{
        var values=Object.fromEntries(new FormData(form).entries());values.token=token;
        await window.SportsGrowApi.request(path,{method:'POST',body:values,redirectOn401:false});
        show(path==='/invites/accept'?'초대를 수락했습니다. 로그인해 주세요.':'비밀번호가 변경되었습니다. 다시 로그인해 주세요.',false);
        window.setTimeout(function(){window.location.href='login.html';},1000);
      }catch(error){show(error.message||'요청을 처리하지 못했습니다.',true);if(button)button.disabled=false;}
    });
  }
  if(invite)submit(invite,'/invites/accept');
  if(reset)submit(reset,'/auth/password/reset');
  if(!token&&message)show('유효한 보안 링크가 없습니다.',true);
})();
