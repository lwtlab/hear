use std::{collections::VecDeque, time::{Duration, Instant}};
use wasapi::*;
fn main() -> Result<(), Box<dyn std::error::Error>> {
 let a:Vec<String>=std::env::args().collect();
 if a.len()!=4 {return Err("Expected explicit QA player PID, channels and keep-event flag".into())}
 let pid:u32=a[1].parse()?;let channels:usize=a[2].parse()?;
 if pid==0 || !(channels==1 || channels==2) {return Err("Invalid explicit target".into())}
 initialize_mta().ok()?;
 let fmt=WaveFormat::new(32,32,&SampleType::Float,48000,channels,None);
 let mut client=AudioClient::new_application_loopback_client(pid,true)?;
 client.initialize_client(&fmt,&Direction::Capture,&StreamMode::EventsShared { autoconvert: true, buffer_duration_hns: 0 })?;
 let event=client.set_get_eventhandle()?;
 let event=if a[3]!="drop"{Some(event)}else{drop(event);None};
 let capture=client.get_audiocaptureclient()?;
 client.start_stream()?;
 let mut q=VecDeque::new();let mut samples=0usize;let mut peak=0f32;let mut squares=0f64;
 let end=Instant::now()+Duration::from_secs(8);
 while Instant::now()<end {
  if capture.get_next_packet_size()?.unwrap_or(0)>0 {
   capture.read_from_device_to_deque(&mut q)?;
   while q.len()>=4 {let b=[q.pop_front().unwrap(),q.pop_front().unwrap(),q.pop_front().unwrap(),q.pop_front().unwrap()];let v=f32::from_le_bytes(b);samples+=1;peak=peak.max(v.abs());squares+=(v as f64).powi(2)}
  }
  if a[3]=="wait" {let _=event.as_ref().unwrap().wait_for_event(250);} else {std::thread::sleep(Duration::from_millis(3));}
 }
 client.stop_stream()?;drop(event);
 println!("{{\"channels\":{},\"samples\":{},\"peak\":{},\"rms\":{}}}",channels,samples,peak,(squares/samples.max(1) as f64).sqrt());
 Ok(())
}
