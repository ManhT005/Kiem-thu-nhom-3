document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  if (!token) { window.location.href = "/login"; return; }
  const form = document.getElementById("voucher-form"), filters = document.getElementById("voucher-filter");
  const message = document.getElementById("voucher-message");
  let editingId = null, page = 1;
  const tell = (text,error=false) => { message.textContent=text; message.className=error?"error":""; };
  async function api(path,options={}) {
    const response = await fetch("/api/admin/vouchers"+path,{...options,headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
      body:options.data?JSON.stringify(options.data):undefined});
    const result = await response.json(); if(!response.ok)throw new Error(result.message||"Không thể thực hiện thao tác");
    return result.data;
  }
  const localDate = (date) => { const value=new Date(date);return new Date(value.getTime()-value.getTimezoneOffset()*60000).toISOString().slice(0,16); };
  function fresh() {
    editingId=null; form.reset(); form.elements.startAt.value=localDate(Date.now()-60000);form.elements.endAt.value=localDate(Date.now()+86400000*7);
    document.getElementById("voucher-title").textContent="Tạo voucher";
  }
  async function busy(button,work) {
    if(button.disabled)return; button.disabled=true;button.setAttribute("aria-busy","true");tell("Đang xử lý...");
    try{await work();}catch(error){tell(error.message,true);}finally{button.disabled=false;button.removeAttribute("aria-busy");}
  }
  async function load() {
    const query=new URLSearchParams({page,limit:20});
    for(const name of ["code","enabled"])if(filters.elements[name].value.trim())query.set(name,filters.elements[name].value.trim());
    const result=await api("?"+query),body=document.getElementById("vouchers");body.replaceChildren();
    for(const voucher of result.items) {
      const row=document.createElement("tr");
      for(const value of [voucher.code, voucher.discount_value+(voucher.discount_type==="PERCENT"?"%":" VND"),
        new Date(voucher.start_at).toLocaleString()+" → "+new Date(voucher.end_at).toLocaleString(),
        `${voucher.used_count} / ${voucher.usage_limit??"Không giới hạn"}`,voucher.enabled?"Đang bật":"Đã tắt"]) {
        const cell=document.createElement("td");cell.textContent=String(value);row.append(cell);
      }
      const cell=document.createElement("td"),edit=document.createElement("button"),toggle=document.createElement("button");
      edit.type=toggle.type="button";edit.textContent="Chỉnh sửa";toggle.textContent=voucher.enabled?"Tắt":"Bật";
      edit.onclick=()=>{
        editingId=voucher.maGiamGia;
        for(const[name,field]of [["code","code"],["discountType","discount_type"],["discountValue","discount_value"],["minimumOrderAmount","minimum_order_amount"],
          ["maximumDiscountAmount","maximum_discount_amount"],["usageLimit","usage_limit"],["perUserLimit","per_user_limit"],["description","moTa"]])form.elements[name].value=voucher[field]??"";
        form.elements.startAt.value=localDate(voucher.start_at);form.elements.endAt.value=localDate(voucher.end_at);form.elements.enabled.checked=Boolean(voucher.enabled);
        form.elements.discountValue.max=voucher.discount_type==="PERCENT"?"100":"999999999999.99";
        document.getElementById("voucher-title").textContent="Chỉnh voucher "+voucher.code;form.scrollIntoView({behavior:"auto"});
      };
      toggle.onclick=()=>busy(toggle,async()=>{await api("/"+voucher.maGiamGia+"/status",{method:"PATCH",data:{enabled:!voucher.enabled}});tell("Đã đổi trạng thái voucher.");await load();});
      cell.append(edit,toggle);row.append(cell);body.append(row);
    }
    document.getElementById("voucher-page").textContent=`Trang ${page} / ${Math.max(1,result.pagination.totalPages)}`;
    document.getElementById("voucher-prev").disabled=page===1;document.getElementById("voucher-next").disabled=page>=result.pagination.totalPages;
  }
  form.elements.discountType.onchange=()=>{form.elements.discountValue.max=form.elements.discountType.value==="PERCENT"?"100":"999999999999.99";};
  form.onsubmit=(event)=>{
    event.preventDefault();busy(document.getElementById("save-voucher"),async()=>{
      const value=(name)=>form.elements[name].value;
      const data={code:value("code"),discountType:value("discountType"),discountValue:value("discountValue"),minimumOrderAmount:value("minimumOrderAmount"),
        maximumDiscountAmount:value("maximumDiscountAmount")===""?null:value("maximumDiscountAmount"),
        startAt:new Date(value("startAt")).toISOString(),endAt:new Date(value("endAt")).toISOString(),
        usageLimit:value("usageLimit")===""?null:Number(value("usageLimit")),perUserLimit:Number(value("perUserLimit")),
        description:value("description"),enabled:form.elements.enabled.checked};
      await api(editingId?"/"+editingId:"",{method:editingId?"PUT":"POST",data});fresh();tell("Đã lưu voucher.");await load();
    });
  };
  document.getElementById("new-voucher").onclick=fresh;
  filters.onsubmit=(event)=>{event.preventDefault();page=1;load().catch(error=>tell(error.message,true));};
  document.getElementById("voucher-prev").onclick=()=>{page--;load().catch(error=>tell(error.message,true));};
  document.getElementById("voucher-next").onclick=()=>{page++;load().catch(error=>tell(error.message,true));};
  fresh();try{await load();tell("Sẵn sàng quản lý voucher.");}catch(error){tell(error.message,true);document.getElementById("save-voucher").disabled=true;}
});
