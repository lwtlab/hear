// Dedicated approved-sample player. Never records or changes endpoint settings.
use std::{path::Path, time::{Duration, Instant}};
use sha2::{Digest,Sha256};
use wasapi::{AudioClientProperties,Direction,SampleType,StreamMode,WaveFormat};
use windows::Win32::Media::Audio::{AudioCategory_Other,AudioCategory_Media,AudioCategory_Communications};
fn main()->Result<(),Box<dyn std::error::Error>> {
 let a:Vec<String>=std::env::args().collect();
 wasapi::initialize_mta().ok()?;
 let enumerator=wasapi::DeviceEnumerator::new()?;
 let fingerprint=|device:&wasapi::Device|->Result<String,Box<dyn std::error::Error>>{Ok(format!("{:x}",Sha256::digest(device.get_id()?.as_bytes())))};
 if a.len()==2&&a[1]=="--list" {
  let devices=enumerator.get_device_collection(&Direction::Render)?;let default=fingerprint(&enumerator.get_default_device(&Direction::Render)?)?;let mut rows=Vec::new();
  for i in 0..devices.get_nbr_devices()?{let device=devices.get_device_at_index(i)?;let id=fingerprint(&device)?;let format=device.get_iaudioclient()?.get_mixformat()?;
   rows.push(format!("{{\"fingerprint\":\"{}\",\"default\":{},\"rate\":{},\"channels\":{},\"bits\":{},\"sampleType\":\"{:?}\"}}",id,id==default,format.get_samplespersec(),format.get_nchannels(),format.get_bitspersample(),format.get_subformat()?));}
  println!("{{\"scope\":\"Read-only active render endpoint fingerprints and formats; no names or combined signal\",\"endpoints\":[{}]}}",rows.join(","));return Ok(())
 }
 if !(4..=6).contains(&a.len())||!["other","media","communications"].contains(&a[2].as_str())||a.get(5).is_some_and(|x|x!="mix"){return Err("Expected approved sample, other/media/communications category, own stop-marker path, optional endpoint fingerprint and mix flag".into())}
 let data=std::fs::read(&a[1])?;if format!("{:x}",Sha256::digest(&data))!="1577c1b3a7b62d24513c94bacca2e431555b5a1e0f4d43af235bf3296db87c67"{return Err("Unapproved sample".into())}
 if data.get(0..4)!=Some(b"RIFF")||data.get(8..12)!=Some(b"WAVE"){return Err("Invalid WAV".into())}
 let(mut offset,mut pcm,mut valid)=(12,None,false);
 while offset+8<=data.len(){let n=u32::from_le_bytes(data[offset+4..offset+8].try_into()?)as usize;let end=offset.checked_add(8+n).ok_or("Invalid chunk")?;if end>data.len(){return Err("Truncated WAV".into())}
  if &data[offset..offset+4]==b"fmt "&&n>=16{let f=&data[offset+8..end];valid=u16::from_le_bytes(f[0..2].try_into()?)==1&&u16::from_le_bytes(f[2..4].try_into()?)==1&&u32::from_le_bytes(f[4..8].try_into()?)==16000&&u16::from_le_bytes(f[14..16].try_into()?)==16;}
  if &data[offset..offset+4]==b"data"{pcm=Some(&data[offset+8..end]);}offset=end+(n%2);
 }
 if !valid{return Err("Expected approved PCM16 16k mono WAV".into())}let samples:Vec<f32>=pcm.ok_or("No PCM")?.chunks_exact(2).map(|x|i16::from_le_bytes([x[0],x[1]])as f32/32768.0).collect();if samples.is_empty(){return Err("Empty PCM".into())}
 let device=if let Some(target)=a.get(4){
  if target.len()!=64||!target.chars().all(|c|c.is_ascii_hexdigit()&&!c.is_ascii_uppercase()){return Err("Invalid endpoint fingerprint".into())}
  let devices=enumerator.get_device_collection(&Direction::Render)?;let mut selected=None;
  for i in 0..devices.get_nbr_devices()?{let d=devices.get_device_at_index(i)?;if fingerprint(&d)?==*target{selected=Some(d);break}}
  selected.ok_or("Reviewed endpoint no longer available")?
 }else{enumerator.get_default_device(&Direction::Render)?};let endpoint=fingerprint(&device)?;let mut client=device.get_iaudioclient()?;
 let category=match a[2].as_str(){"other"=>AudioCategory_Other,"media"=>AudioCategory_Media,_=>AudioCategory_Communications};client.set_properties(AudioClientProperties::new().set_category(category).set_offload(false))?;
 let format=if a.get(5).is_some(){client.get_mixformat()?}else{WaveFormat::new(32,32,&SampleType::Float,48000,2,None)};
 let rate=format.get_samplespersec()as usize;let channels=format.get_nchannels()as usize;let kind=format.get_subformat()?;let bits=format.get_bitspersample();
 if rate==0||channels==0||!matches!((&kind,bits),(SampleType::Float,32)|(SampleType::Int,16)|(SampleType::Int,32)){return Err("Diagnostic renderer does not support this mix format".into())}
 client.initialize_client(&format,&Direction::Render,&StreamMode::EventsShared{autoconvert:true,buffer_duration_hns:200000})?;
 let event=client.set_get_eventhandle()?;let render=client.get_audiorenderclient()?;let mut cursor=0usize;
 let fill=|frames:usize,cursor:&mut usize|{let mut bytes=Vec::with_capacity(frames*channels*bits as usize/8);for _ in 0..frames{let v=samples[(*cursor*16000/rate)%samples.len()];for _ in 0..channels{match (&kind,bits){(SampleType::Float,32)=>bytes.extend_from_slice(&v.to_le_bytes()),(SampleType::Int,16)=>bytes.extend_from_slice(&((v*32767.0)as i16).to_le_bytes()),_=>bytes.extend_from_slice(&((v as f64*2147483647.0)as i32).to_le_bytes())}}*cursor+=1;}bytes};
 let n=client.get_available_space_in_frames()?as usize;render.write_to_device(n,&fill(n,&mut cursor),None)?;client.start_stream()?;
 let stop=Path::new(&a[3]);let ready=stop.with_file_name("native-render-ready.json");std::fs::write(&ready,format!("{{\"pid\":{},\"category\":\"{}\",\"endpoint\":\"{}\",\"rate\":{},\"channels\":{},\"bits\":{},\"offload\":false,\"sourceVerified\":true}}",std::process::id(),a[2],endpoint,rate,channels,bits))?;
 let end=Instant::now()+Duration::from_secs(90);while Instant::now()<end&&!stop.exists(){let n=client.get_available_space_in_frames()?as usize;if n>0{render.write_to_device(n,&fill(n,&mut cursor),None)?;}let _=event.wait_for_event(100);}
 client.stop_stream()?;println!("{{\"category\":\"{}\",\"renderedFrames\":{}}}",a[2],cursor);Ok(())
}
