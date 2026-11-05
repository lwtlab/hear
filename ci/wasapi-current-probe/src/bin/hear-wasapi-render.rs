// Dedicated approved-sample player. Never records or changes endpoint settings.
use std::{path::Path, time::{Duration, Instant}};
use sha2::{Digest,Sha256};
use wasapi::{AudioClientProperties,Direction,SampleType,StreamMode,WaveFormat};
use windows::Win32::Media::Audio::{AudioCategory_Other,AudioCategory_Media,AudioCategory_Communications};
fn main()->Result<(),Box<dyn std::error::Error>> {
 let a:Vec<String>=std::env::args().collect();if a.len()!=4||!["other","media","communications"].contains(&a[2].as_str()){return Err("Expected approved sample, other/media/communications category and own stop-marker path".into())}
 let data=std::fs::read(&a[1])?;if format!("{:x}",Sha256::digest(&data))!="1577c1b3a7b62d24513c94bacca2e431555b5a1e0f4d43af235bf3296db87c67"{return Err("Unapproved sample".into())}
 if data.get(0..4)!=Some(b"RIFF")||data.get(8..12)!=Some(b"WAVE"){return Err("Invalid WAV".into())}
 let(mut offset,mut pcm,mut valid)=(12,None,false);
 while offset+8<=data.len(){let n=u32::from_le_bytes(data[offset+4..offset+8].try_into()?)as usize;let end=offset.checked_add(8+n).ok_or("Invalid chunk")?;if end>data.len(){return Err("Truncated WAV".into())}
  if &data[offset..offset+4]==b"fmt "&&n>=16{let f=&data[offset+8..end];valid=u16::from_le_bytes(f[0..2].try_into()?)==1&&u16::from_le_bytes(f[2..4].try_into()?)==1&&u32::from_le_bytes(f[4..8].try_into()?)==16000&&u16::from_le_bytes(f[14..16].try_into()?)==16;}
  if &data[offset..offset+4]==b"data"{pcm=Some(&data[offset+8..end]);}offset=end+(n%2);
 }
 if !valid{return Err("Expected approved PCM16 16k mono WAV".into())}let samples:Vec<f32>=pcm.ok_or("No PCM")?.chunks_exact(2).map(|x|i16::from_le_bytes([x[0],x[1]])as f32/32768.0).collect();if samples.is_empty(){return Err("Empty PCM".into())}
 wasapi::initialize_mta().ok()?;let device=wasapi::DeviceEnumerator::new()?.get_default_device(&Direction::Render)?;let mut client=device.get_iaudioclient()?;
 let category=match a[2].as_str(){"other"=>AudioCategory_Other,"media"=>AudioCategory_Media,_=>AudioCategory_Communications};client.set_properties(AudioClientProperties::new().set_category(category).set_offload(false))?;
 let format=WaveFormat::new(32,32,&SampleType::Float,48000,2,None);client.initialize_client(&format,&Direction::Render,&StreamMode::EventsShared{autoconvert:true,buffer_duration_hns:200000})?;
 let event=client.set_get_eventhandle()?;let render=client.get_audiorenderclient()?;let mut cursor=0usize;
 let fill=|frames:usize,cursor:&mut usize|{let mut bytes=Vec::with_capacity(frames*8);for _ in 0..frames{let v=samples[(*cursor/3)%samples.len()].to_le_bytes();bytes.extend_from_slice(&v);bytes.extend_from_slice(&v);*cursor+=1;}bytes};
 let n=client.get_available_space_in_frames()?as usize;render.write_to_device(n,&fill(n,&mut cursor),None)?;client.start_stream()?;
 let stop=Path::new(&a[3]);let ready=stop.with_file_name("native-render-ready.json");std::fs::write(&ready,format!("{{\"pid\":{},\"category\":\"{}\",\"offload\":false,\"sourceVerified\":true}}",std::process::id(),a[2]))?;
 let end=Instant::now()+Duration::from_secs(90);while Instant::now()<end&&!stop.exists(){let n=client.get_available_space_in_frames()?as usize;if n>0{render.write_to_device(n,&fill(n,&mut cursor),None)?;}let _=event.wait_for_event(100);}
 client.stop_stream()?;println!("{{\"category\":\"{}\",\"renderedFrames\":{}}}",a[2],cursor);Ok(())
}
