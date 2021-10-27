#ifndef REPLACERCONFIG_H
#define REPLACERCONFIG_H
#pragma once

#include <exception>
#include <fstream>
#include <iostream>
#include <sstream>
#include <string>
#include <utility>
#include <vector>

#include <boost/filesystem.hpp>
#include <boost/program_options.hpp>
// clang-format off
#include <ryml/ryml_std.hpp>
#include <ryml/ryml.hpp>
// clang-format on

#include "Generator.hpp"

using std::string;
using std::vector;
namespace po = boost::program_options;
namespace fs = boost::filesystem;

class ReplacerConfig {
private:
  fs::path _main_source_path, _extra_source_path, _main_target_path,
      _extra_target_path, _config_path;
  string _lang, _version;
  vector<Generator> _generators;

  string _get_file_contents(const string &filename);
  void _parse_config();
  void _parse_generator(const ryml::NodeRef &node);
  static string _read_val(const ryml::NodeRef &node);
  static string _read_val(const ryml::NodeRef &node, const string &key);
  static bool _str2bool(const string &str);

public:
  ReplacerConfig(int argc, char const *argv[]);
  ~ReplacerConfig();
  const fs::path &main_source_path();
  const fs::path &extra_source_path();
  const fs::path &main_target_path();
  const fs::path &extra_target_path();
  const fs::path &config_path();
  const string &lang();
  const string &version();
  const vector<Generator> &generators();
};
#endif