#ifndef CONFIGPARSER_H
#define CONFIGPARSER_H
#pragma once

#include <exception>
#include <fstream>
#include <iostream>
#include <sstream>

// clang-format off
#include <ryml/ryml_std.hpp>
#include <ryml/ryml.hpp>
// clang-format on

#include "../generator/DictGenerator.hpp"
#include "../generator/Generator.hpp"
#include "../generator/Rule.hpp"
#include "../generator/RuleGenerator.hpp"
#include "../meta/NSGeneratorMeta.hpp"
#include "Config.hpp"
#include "RuntimeOptions.hpp"

class ConfigParser {
private:
  static string _read_val(const ryml::NodeRef &node);
  static string _read_val(const ryml::NodeRef &node, const string &key);
  static bool _str2bool(const string &str);
  static string _csubstr2str(const c4::csubstr &str);
  static string _get_file_contents(const string &filename);
  static bool _path_valid(const fs::path &path, bool require_exist = true);
  static fs::path _determine_path(const fs::path &original,
                                  const fs::path &workplace,
                                  const fs::path &replaced,
                                  bool require_exist = true);

  static void _parse_config_file(Config &config);
  static void _determine_config_path(Config &config);
  static void _determine_input_paths(Config &config);

public:
  static Config parse_config(const RuntimeOptions &options);
  static vector<shared_ptr<Generator>>
  parse_generator(const ryml::NodeRef &node);
  static shared_ptr<Rule> parse_rule(const ryml::NodeRef &node);
};
#endif