// Scoped signal-only experiment: explicit QA-player PID, never an endpoint/exclude capture.
use std::time::{Duration, Instant};
use wasapi::{initialize_mta, AudioClient, SampleType, WaveFormat};
use windows::Win32::Media::Audio::*;
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let a: Vec<String> = std::env::args().collect();
    if a.len() != 6 { return Err("Expected verified player PID, rate, f32/i16, ex/ext and high/default quality".into()); }
    let pid: u32 = a[1].parse()?; let rate: usize = a[2].parse()?;
    if pid == 0 || ![44100,48000].contains(&rate) || !["f32","i16"].contains(&a[3].as_str()) || !["ex","ext"].contains(&a[4].as_str()) || !["high","default"].contains(&a[5].as_str()) { return Err("Invalid explicit experiment parameters".into()); }
    initialize_mta().ok()?;
    let bits = if a[3] == "i16" {16} else {32};
    let kind = if bits == 16 {SampleType::Int} else {SampleType::Float};
    let fmt = WaveFormat::new(bits,bits,&kind,rate,2,None);
    let fmt = if a[4] == "ex" {fmt.to_waveformatex()?} else {fmt};
    let client = AudioClient::new_application_loopback_client(pid,true)?;
    let raw = client.as_iaudioclient();
    let mut flags = AUDCLNT_STREAMFLAGS_LOOPBACK | AUDCLNT_STREAMFLAGS_EVENTCALLBACK | AUDCLNT_STREAMFLAGS_AUTOCONVERTPCM;
    if a[5] == "high" {flags |= AUDCLNT_STREAMFLAGS_SRC_DEFAULT_QUALITY;}
    unsafe { raw.Initialize(AUDCLNT_SHAREMODE_SHARED, flags, 0,0, fmt.as_waveformatex_ref(), None)?; }
    let event = client.set_get_eventhandle()?;
    let capture: IAudioCaptureClient = unsafe {raw.GetService()?};
    unsafe {raw.Start()?;}
    let end = Instant::now()+Duration::from_secs(6);
    let mut count=0usize; let mut squares=0f64; let mut peak=0f64; let mut silent=0u64; let mut packets=0u64;
    while Instant::now()<end {
        while unsafe {capture.GetNextPacketSize()?}>0 {
            let mut data=std::ptr::null_mut();let mut frames=0;let mut info=0;
            unsafe {capture.GetBuffer(&mut data,&mut frames,&mut info,None,None)?;}
            let n=frames as usize*2;packets+=1;
            if info & AUDCLNT_BUFFERFLAGS_SILENT.0 as u32 != 0 {silent+=frames as u64;count+=n;}
            else if n>0 {
                if data.is_null() {return Err("Non-silent buffer has null data".into());}
                // The API buffer belongs to this explicit stream and is read only until ReleaseBuffer.
                let bytes=unsafe {std::slice::from_raw_parts(data,n*bits as usize/8)};
                for chunk in bytes.chunks_exact(bits as usize/8) {
                    let v=if bits==16 {i16::from_le_bytes(chunk.try_into()?) as f64/32768.0} else {f32::from_le_bytes(chunk.try_into()?) as f64};
                    if !v.is_finite(){return Err("Non-finite PCM".into());}count+=1;squares+=v*v;peak=peak.max(v.abs());
                }
            }
            unsafe {capture.ReleaseBuffer(frames)?;}
        }
        let _=event.wait_for_event(250);
    }
    unsafe {raw.Stop()?;}
    println!("{{\"rate\":{},\"bits\":{},\"format\":\"{}\",\"quality\":\"{}\",\"samples\":{},\"peak\":{},\"rms\":{},\"silentFrames\":{},\"packets\":{}}}",rate,bits,a[4],a[5],count,peak,(squares/count.max(1) as f64).sqrt(),silent,packets);
    Ok(())
}
