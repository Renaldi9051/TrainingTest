// Dua artikel contoh (permintaan pemilik, 1 Nov 2026): teks ditulis sendiri, topik mengikuti katalog
// pelatihan (akuntansi/audit dan pengembangan SDM). Sampul memakai gambar kategori pelatihan yang sudah ada
// (coverFromTrainingCategory = slug kategori pelatihan); kalau tidak ada, artikel tanpa sampul.

export type SeedArticle = {
  slug: string;
  title: string;
  excerpt: string;
  authorName: string;
  category: { slug: string; name: string };
  coverFromTrainingCategory: string;
  body: unknown;
};

export const sampleArticles: SeedArticle[] = [
  {
    "slug": "5-kebiasaan-pencatatan-keuangan-yang-memudahkan-audit",
    "title": "5 Kebiasaan Pencatatan Keuangan yang Memudahkan Audit",
    "excerpt": "Audit yang lancar dimulai jauh sebelum auditor datang. Lima kebiasaan sederhana ini membantu tim keuangan menyiapkan bukti, mempercepat pemeriksaan, dan mengurangi temuan berulang.",
    "authorName": "Tim Media",
    "category": {
      "slug": "keuangan-dan-akuntansi",
      "name": "Keuangan & Akuntansi"
    },
    "coverFromTrainingCategory": "accounting",
    "body": {
      "type": "doc",
      "content": [
        {
          "type": "paragraph",
          "content": [
            {
              "text": "Banyak tim keuangan baru sibuk merapikan dokumen ketika jadwal audit sudah dekat. Akibatnya, waktu habis untuk mencari bukti transaksi, menjelaskan selisih, dan menjawab pertanyaan yang sebenarnya bisa dicegah. Kabar baiknya, sebagian besar hambatan itu bisa diatasi dengan kebiasaan pencatatan yang konsisten setiap hari.",
              "type": "text"
            }
          ]
        },
        {
          "type": "heading",
          "attrs": {
            "level": 2
          },
          "content": [
            {
              "text": "1. Catat transaksi di hari yang sama",
              "type": "text"
            }
          ]
        },
        {
          "type": "paragraph",
          "content": [
            {
              "text": "Transaksi yang dicatat terlambat cenderung kehilangan konteks: siapa yang menyetujui, untuk keperluan apa, dan dokumen apa yang menyertainya. Biasakan mencatat transaksi pada hari terjadinya, lengkap dengan keterangan singkat yang bisa dipahami orang lain.",
              "type": "text"
            }
          ]
        },
        {
          "type": "heading",
          "attrs": {
            "level": 2
          },
          "content": [
            {
              "text": "2. Simpan bukti dengan penamaan yang seragam",
              "type": "text"
            }
          ]
        },
        {
          "type": "paragraph",
          "content": [
            {
              "text": "Bukti transaksi yang tersimpan rapi menghemat waktu paling banyak saat audit. Sepakati satu pola penamaan file, misalnya tanggal, nomor dokumen, lalu nama vendor, dan simpan di folder per bulan.",
              "type": "text"
            }
          ]
        },
        {
          "type": "heading",
          "attrs": {
            "level": 2
          },
          "content": [
            {
              "text": "3. Rekonsiliasi rutin, bukan menjelang tutup buku",
              "type": "text"
            }
          ]
        },
        {
          "type": "paragraph",
          "content": [
            {
              "text": "Rekonsiliasi bank dan akun utang-piutang yang dilakukan setiap minggu membuat selisih kecil cepat ketahuan, sebelum menumpuk dan sulit ditelusuri.",
              "type": "text"
            }
          ]
        },
        {
          "type": "heading",
          "attrs": {
            "level": 2
          },
          "content": [
            {
              "text": "4. Pisahkan tugas pencatat dan penyetuju",
              "type": "text"
            }
          ]
        },
        {
          "type": "paragraph",
          "content": [
            {
              "text": "Pemisahan tugas adalah salah satu pengendalian internal yang paling sering diperiksa auditor. Orang yang mencatat transaksi sebaiknya tidak sama dengan orang yang menyetujui pembayaran.",
              "type": "text"
            }
          ]
        },
        {
          "type": "heading",
          "attrs": {
            "level": 2
          },
          "content": [
            {
              "text": "5. Dokumentasikan kebijakan akuntansi",
              "type": "text"
            }
          ]
        },
        {
          "type": "paragraph",
          "content": [
            {
              "text": "Kebijakan yang hanya ada di kepala satu orang akan menyulitkan saat orang itu tidak ada. Tuliskan kebijakan penting secara ringkas, seperti batas kapitalisasi aset, metode penyusutan, dan alur persetujuan biaya.",
              "type": "text"
            }
          ]
        },
        {
          "type": "heading",
          "attrs": {
            "level": 2
          },
          "content": [
            {
              "text": "Mulai dari yang paling berdampak",
              "type": "text"
            }
          ]
        },
        {
          "type": "paragraph",
          "content": [
            {
              "text": "Tidak perlu menerapkan semuanya sekaligus. Pilih satu atau dua kebiasaan yang paling sering menjadi masalah di tim Anda, jalankan selama satu periode, lalu evaluasi hasilnya. Pelatihan akuntansi dan audit internal dapat membantu tim menyusun prosedur yang sesuai dengan kondisi perusahaan.",
              "type": "text"
            }
          ]
        }
      ]
    }
  },
  {
    "slug": "cara-memilih-pelatihan-komunikasi-yang-tepat-untuk-tim",
    "title": "Cara Memilih Pelatihan Komunikasi yang Tepat untuk Tim",
    "excerpt": "Pelatihan komunikasi paling bermanfaat jika menjawab masalah nyata di tim. Berikut langkah praktis memilih program yang sesuai, dari memetakan kebutuhan sampai mengukur hasilnya.",
    "authorName": "Tim Media",
    "category": {
      "slug": "pengembangan-sdm",
      "name": "Pengembangan SDM"
    },
    "coverFromTrainingCategory": "employee",
    "body": {
      "type": "doc",
      "content": [
        {
          "type": "paragraph",
          "content": [
            {
              "text": "Keluhan seperti rapat yang berlarut-larut, pesan yang sering disalahpahami, atau koordinasi antardivisi yang lambat sering berujung pada satu kesimpulan: tim perlu pelatihan komunikasi. Namun, \"komunikasi\" adalah topik yang luas. Program yang tepat untuk satu tim belum tentu cocok untuk tim lain.",
              "type": "text"
            }
          ]
        },
        {
          "type": "heading",
          "attrs": {
            "level": 2
          },
          "content": [
            {
              "text": "Petakan masalahnya dulu",
              "type": "text"
            }
          ]
        },
        {
          "type": "paragraph",
          "content": [
            {
              "text": "Sebelum memilih program, kumpulkan contoh situasi yang paling sering bermasalah. Beberapa pertanyaan yang bisa membantu:",
              "type": "text"
            }
          ]
        },
        {
          "type": "bulletList",
          "content": [
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "text": "Di mana miskomunikasi paling sering terjadi? ",
                      "type": "text",
                      "marks": [
                        {
                          "type": "bold"
                        }
                      ]
                    },
                    {
                      "text": "Misalnya di rapat, email, atau serah terima pekerjaan.",
                      "type": "text"
                    }
                  ]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "text": "Siapa yang terlibat? ",
                      "type": "text",
                      "marks": [
                        {
                          "type": "bold"
                        }
                      ]
                    },
                    {
                      "text": "Antaranggota tim, atasan dengan bawahan, atau tim dengan pelanggan.",
                      "type": "text"
                    }
                  ]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "text": "Apa dampaknya? ",
                      "type": "text",
                      "marks": [
                        {
                          "type": "bold"
                        }
                      ]
                    },
                    {
                      "text": "Pekerjaan diulang, tenggat terlewat, atau keluhan pelanggan.",
                      "type": "text"
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          "type": "heading",
          "attrs": {
            "level": 2
          },
          "content": [
            {
              "text": "Cocokkan dengan jenis pelatihan",
              "type": "text"
            }
          ]
        },
        {
          "type": "paragraph",
          "content": [
            {
              "text": "Dari pemetaan itu, arah pelatihan biasanya terlihat. Masalah di rapat dan presentasi cocok dengan pelatihan komunikasi efektif dan presentasi. Masalah dengan pelanggan lebih tepat ditangani lewat pelatihan layanan pelanggan. Konflik antaranggota tim bisa dibantu dengan pelatihan komunikasi interpersonal atau kerja sama tim.",
              "type": "text"
            }
          ]
        },
        {
          "type": "heading",
          "attrs": {
            "level": 2
          },
          "content": [
            {
              "text": "Perhatikan format dan metode",
              "type": "text"
            }
          ]
        },
        {
          "type": "paragraph",
          "content": [
            {
              "text": "Komunikasi adalah keterampilan, jadi porsi praktik lebih penting daripada teori. Pilih program yang menyediakan simulasi, studi kasus dari pekerjaan sehari-hari, dan umpan balik langsung. Untuk tim yang masalahnya sangat spesifik, kelas in-house biasanya lebih efektif karena materinya bisa disesuaikan.",
              "type": "text"
            }
          ]
        },
        {
          "type": "heading",
          "attrs": {
            "level": 2
          },
          "content": [
            {
              "text": "Ukur hasilnya",
              "type": "text"
            }
          ]
        },
        {
          "type": "orderedList",
          "content": [
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "text": "Tetapkan satu atau dua indikator sebelum pelatihan, misalnya durasi rapat atau jumlah revisi pekerjaan.",
                      "type": "text"
                    }
                  ]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "text": "Minta peserta menerapkan satu teknik baru dalam dua minggu pertama.",
                      "type": "text"
                    }
                  ]
                }
              ]
            },
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "text": "Bandingkan indikator sebelum dan sesudah, lalu diskusikan bersama tim.",
                      "type": "text"
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          "type": "paragraph",
          "content": [
            {
              "text": "Dengan langkah ini, pelatihan komunikasi tidak berhenti di ruang kelas, tetapi benar-benar terasa dalam cara tim bekerja sehari-hari.",
              "type": "text"
            }
          ]
        }
      ]
    }
  }
];
